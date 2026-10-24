// Host half of dsh-boot-handmade: an app-lock backend for the cold-start gate.
//
// The browser half draws the animation; this half owns the actual check:
//   - a PIN stored as a salted scrypt hash in $DSH_HOME/boot-auth.json
//   - Windows Hello (fingerprint / face / PIN) through UserConsentVerifier
//   - a short-lived session cookie once the gate has been passed
//
// Scope, stated plainly: this locks the *animation's* gate, not the whole web
// app. Anything served by the host stays reachable to a client that ignores the
// overlay. Real enforcement would have to sit in front of the app shell, which
// a profile plugin cannot reach.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import {
  readTotp, writeTotp, newSecret, otpauthUri, newBackupCodes, hashBackupCode,
  matchBackupCode, verifyCode as verifyTotpCode, BACKUP_COUNT,
} from './totp.js'
import {
  readConfig as readRecoverConfig, destination as recoverDestination, smtp as recoverSmtp,
  smsReady, sendSms, maskPhone,
  maskEmail, newChallenge, checkChallenge, sendMail,
  CODE_TTL_MS, RESEND_COOLDOWN_MS, MAX_PER_HOUR, MAX_ATTEMPTS,
} from './recover.js'

export const name = 'bootHandmade'

export const inject = []

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

// 桌面启动器是选装件：装与不装都在用户手里，旧入口永远保留。
const HERE = path.dirname(fileURLToPath(import.meta.url))
const LAUNCHER_DIR = path.join(HERE, '..', 'launcher')
const LAUNCHER_PS1 = path.join(LAUNCHER_DIR, 'install-launcher.ps1')
const SHORTCUT_NAME = 'DeepSeek Harness (Launcher).lnk'

function desktopDirs() {
  const home = os.homedir()
  return [
    path.join(home, 'Desktop'),
    path.join(home, 'OneDrive', 'Desktop'),
    path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop'),
  ]
}

function launcherStatus() {
  const found = desktopDirs()
    .map((dir) => path.join(dir, SHORTCUT_NAME))
    .filter((file) => { try { return fs.existsSync(file) } catch { return false } })
  return {
    installed: found.length > 0,
    shortcut: found[0] || null,
    available: fs.existsSync(LAUNCHER_PS1),
  }
}
const AUTH_FILE = path.join(DSH_HOME, 'boot-auth.json')
// Escape hatch for the first releases: while this file exists the gate reports
// itself as already unlocked. Creating it needs no GUI, which is the point —
// a broken lock must never cost more than one file.
const BYPASS_FILE = path.join(DSH_HOME, 'boot-auth-bypass')
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCKOUT_MS = 30 * 1000

const sessions = new Map()          // token -> expiresAt
// Most recent "this person just proved who they are" timestamp. Changing the PIN
// uses it as the credential, so a fingerprint or a code that *just* passed counts
// and the old PIN does not have to be typed again. Five minutes.
let provedAt = 0
const PROOF_TTL_MS = 5 * 60 * 1000

const failures = new Map()          // remote address -> { count, until }
const recoverySends = []            // timestamps of mails sent, for rate limiting
const totpFailures = new Map()      // remote address -> { count, until }
let recoveryChallenge = null        // { hash, salt, expiresAt, attempts }

function readAuth() {
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.hash === 'string' && typeof parsed.salt === 'string') return parsed
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[boot-handmade] cannot read auth file:', error)
  }
  return null
}

function writeAuth(value) {
  fs.mkdirSync(DSH_HOME, { recursive: true })
  const tmp = AUTH_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, AUTH_FILE)
}

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), Buffer.from(salt, 'hex'), 32).toString('hex')
}

function sameHash(a, b) {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

function issueSession() {
  const token = crypto.randomBytes(24).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  return token
}

function sessionOf(req) {
  const raw = req.headers.cookie || ''
  const match = /(?:^|;\s*)boot_auth=([a-f0-9]+)/.exec(raw)
  if (!match) return null
  const expiry = sessions.get(match[1])
  if (!expiry || expiry < Date.now()) {
    sessions.delete(match[1])
    return null
  }
  return match[1]
}

function isTrustedRequest(req) {
  // Loopback + same-origin only: a page on another host must not drive the lock.
  const origin = req.headers.origin || req.headers.referer || ''
  if (!origin) return true                      // no cross-site context at all
  try {
    const url = new URL(origin)
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function send(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(JSON.stringify(payload))
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) return resolve({})
      try { resolve(JSON.parse(text)) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

// The consent prompt is hosted by CredentialUIBroker.exe and comes up neither
// topmost nor foreground, so an Electron window covering the screen hides it
// completely. Force it to the front while it is alive.
// Windows hosts the Hello prompt in CredentialUIBroker.exe and *reuses* that
// process. If the window is dismissed while a capture session is still active,
// the broker keeps the dead session and the next request never samples: the
// dialog comes up, says "请扫描指纹", and nothing happens.
//
// Killing the broker forces Windows to start a clean one on the next call.
function resetHelloBroker() {
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')
  return new Promise((resolve) => {
    try {
      const child = spawn(exe, ['/F', '/IM', 'CredentialUIBroker.exe'], { windowsHide: true })
      let out = ''
      child.stdout?.on('data', (b) => { out += b.toString() })
      child.stderr?.on('data', (b) => { out += b.toString() })
      child.once('error', () => resolve({ ok: false, detail: 'taskkill missing' }))
      child.once('close', (code) => resolve({ ok: code === 0, code, detail: out.trim().slice(0, 200) }))
    } catch (error) {
      resolve({ ok: false, detail: String(error && error.message) })
    }
  })
}

// A cancelled/timed-out prompt leaves the broker in that stuck state, so the next
// attempt starts by clearing it instead of asking the person to reboot.
let helloNeedsReset = false

function raisePrompt() {
  try {
    const script = path.join(PACKAGE_ROOT, 'raise.ps1')
    if (!fs.existsSync(script)) return
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows',
      'System32/WindowsPowerShell/v1.0/powershell.exe')
    let out = 'ignore'
    try {
      // Keep evidence of whether the prompt really got raised: this is the
      // difference between "the dialog was hidden" and "the dialog never came".
      fs.mkdirSync(DSH_HOME, { recursive: true })
      out = fs.openSync(path.join(DSH_HOME, 'boot-raise.log'), 'a')
    } catch { out = 'ignore' }
    const child = spawn(exe, ['-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', script, '-Seconds', '25'], { windowsHide: true, stdio: ['ignore', out, out] })
    child.once('error', () => {})
    if (typeof child.unref === 'function') child.unref()
  } catch { /* best effort: the prompt still works, just may be hidden */ }
}

function runHello(extraArgs = []) {
  return new Promise((resolve) => {
    const script = path.join(PACKAGE_ROOT, 'hello.ps1')
    if (!fs.existsSync(script)) return resolve({ ok: false, reason: 'helper-missing' })
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows',
      'System32/WindowsPowerShell/v1.0/powershell.exe')
    const child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', script, ...extraArgs], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => { try { child.kill() } catch {} }, 90000)
    child.stdout.on('data', (b) => { out += b.toString() })
    child.stderr.on('data', (b) => { err = (err + b.toString()).slice(-2000) })
    child.once('error', (error) => { clearTimeout(timer); resolve({ ok: false, reason: error.message }) })
    child.once('close', () => {
      clearTimeout(timer)
      const verified = /RESULT=Verified/.test(out)
      const availability = /AVAILABILITY=(\w+)/.exec(out)?.[1] ?? 'unknown'
      resolve({
        ok: verified,
        availability,
        reason: verified ? undefined : (/RESULT=(\w+)/.exec(out)?.[1] ?? 'no-result'),
        stderr: err.trim() || undefined,
      })
    })
  })
}

function registerRoutes(ctx) {
  const statusHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    const auth = readAuth()
    const bypass = fs.existsSync(BYPASS_FILE)
    send(res, 200, {
      configured: Boolean(auth),
      authed: bypass || Boolean(sessionOf(req)),
      bypass,
      hello: auth?.hello ?? 'unknown',
      createdAt: auth?.createdAt ?? null,
    })
  }

  const enrollHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    const pin = String(body.pin ?? '')
    if (!/^\d{4,32}$/.test(pin)) return send(res, 400, { error: 'PIN 需要 4-32 位数字' })
    if (readAuth()) return send(res, 409, { error: 'PIN 已经设置过了' })
    const salt = crypto.randomBytes(16).toString('hex')
    writeAuth({
      salt,
      hash: hashPin(pin, salt),
      hello: body.hello === 'available' ? 'available' : 'unknown',
      createdAt: new Date().toISOString(),
    })
    const token = issueSession()
    send(res, 200, { ok: true }, {
      'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    })
  }

  const pinHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    const auth = readAuth()
    if (!auth) return send(res, 409, { error: '还没有设置 PIN' })
    const key = req.socket?.remoteAddress ?? 'local'
    const state = failures.get(key) ?? { count: 0, until: 0 }
    if (state.until > Date.now()) {
      return send(res, 429, { error: '尝试过多，稍后再试', lockedUntil: state.until })
    }
    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    const pin = String(body.pin ?? '')
    const ok = sameHash(hashPin(pin, auth.salt), auth.hash)
    if (!ok) {
      state.count += 1
      if (state.count >= MAX_FAILURES) {
        state.count = 0
        state.until = Date.now() + LOCKOUT_MS
        failures.set(key, state)
        return send(res, 429, { error: '尝试过多，锁 30 秒', lockedUntil: state.until })
      }
      failures.set(key, state)
      return send(res, 401, { error: 'PIN 不对', remaining: MAX_FAILURES - state.count })
    }
    failures.delete(key)
    provedAt = Date.now()
    const token = issueSession()
    send(res, 200, { ok: true }, {
      'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    })
  }

  // Optional desktop launcher: status / install / uninstall. Never automatic --
  // the original shortcut keeps working, and this only adds a second entry that
  // gives feedback the instant it is clicked.
  // Explicit reset, for the gate's "重试" button: clears a broker that is holding
  // a dead capture session so the next attempt actually samples.
  // Startup timeline: the client reports the few moments that matter, this appends
  // them to one file so "why did it feel slow" has an answer without devtools.
  // Announcement state lives in one file: which version the person has already been
  // told about. A new version resets the prompt, which is why it is keyed by version
  // instead of a boolean.
  const ANNOUNCE_FILE = () => path.join(DSH_HOME, 'boot-announce.json')

  function readAnnounce() {
    try { return JSON.parse(fs.readFileSync(ANNOUNCE_FILE(), 'utf8')) } catch { return {} }
  }

  function writeAnnounce(next) {
    try {
      fs.mkdirSync(DSH_HOME, { recursive: true })
      fs.writeFileSync(ANNOUNCE_FILE(), JSON.stringify(next, null, 2))
    } catch { /* a broken notice file must not block the app */ }
  }

  function currentVersion() {
    try {
      return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version || '0'
    } catch { return '0' }
  }

  function runInstaller(action) {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', LAUNCHER_PS1]
    if (action === 'uninstall') args.push('-Uninstall')
    return new Promise((resolve) => {
      try {
        const child = spawn('powershell.exe', args, { windowsHide: true })
        let out = ''
        child.stdout?.on('data', (b) => { out += b.toString() })
        child.stderr?.on('data', (b) => { out += b.toString() })
        child.once('error', (e) => resolve({ code: -1, out: String(e && e.message) }))
        child.once('close', (code) => resolve({ code, out }))
      } catch (e) { resolve({ code: -1, out: String(e && e.message) }) }
    })
  }

  // status / dismiss / ensure
  // 启动器小窗开关：关掉它只影响“点下去有没有反馈”，不影响程序启动。
  const SETTINGS_FILE = () => path.join(DSH_HOME, 'boot-settings.json')

  function readSettings() {
    const fallback = { splashEnabled: true, theme: 'auto' }
    try { return { ...fallback, ...JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) } } catch { return fallback }
  }

  function writeSettings(next) {
    try {
      fs.mkdirSync(DSH_HOME, { recursive: true })
      fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(next, null, 2))
    } catch { /* 写不进去也不该挡住应用 */ }
  }

  const settingsHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    let body = {}
    if (req.method === 'POST') {
      try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    }
    if (typeof body.splashEnabled === 'boolean' || typeof body.theme === 'string') {
      const next = { ...readSettings() }
      if (typeof body.splashEnabled === 'boolean') next.splashEnabled = body.splashEnabled
      if (['auto', 'light', 'dark'].includes(body.theme)) next.theme = body.theme
      writeSettings(next)
      return send(res, 200, next)
    }
    send(res, 200, readSettings())
  }

  // 独立设置页：由插件自己托管，不依赖 DSH 的任何 UI 接口。
  // 浏览器直接打开 /boot-auth/ui，改 PIN、开关启动小窗都在这里。
  const SETTINGS_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>开机门 · 设置</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0b0b0e;color:#f3eee4;font-family:'Microsoft YaHei','PingFang SC',system-ui,sans-serif}
.card{width:520px;padding:28px 30px 24px;border:1px solid #2c2c38;border-radius:12px;background:#14141a;
box-shadow:0 24px 70px rgba(0,0,0,.6)}
h1{margin:0 0 6px;font-size:17px;letter-spacing:.04em}
.sub{margin:0 0 22px;font-size:12px;color:#8d887e;letter-spacing:.06em}
h2{margin:22px 0 10px;font-size:12px;font-weight:600;letter-spacing:.14em;color:#a29c92}
label{display:block;font-size:11px;color:#8d887e;margin:10px 0 5px;letter-spacing:.1em}
input[type=password],input[type=text]{width:100%;padding:10px 12px;border:1px solid #3a3a46;border-radius:6px;
background:#0f0f14;color:#f3eee4;font-family:ui-monospace,Consolas,monospace;font-size:14px;outline:none}
input:focus{border-color:#ff5a1f}
.row{display:flex;gap:10px;align-items:center;margin-top:14px}
button{border:0;border-radius:6px;padding:10px 16px;font-size:13px;cursor:pointer;
background:#232330;color:#c9c3b8;font-family:inherit}
button.primary{background:#ff5a1f;color:#14141a;font-weight:600}
button:disabled{opacity:.5;cursor:default}
.msg{min-height:18px;margin-top:12px;font-size:12px;color:#8d887e}
.msg.ok{color:#41ba41}
.msg.err{color:#ff2d55}
.sep{height:1px;background:#232330;margin:22px 0 4px}
.switch{display:flex;align-items:center;gap:10px;font-size:12.5px;color:#c9c3b8;margin-top:8px}
</style></head>
<body><div class="card">
<h1>开机门 · 设置</h1>
<p class="sub">这份设置属于插件本身，和 DSH 的界面无关。</p>

<h2>更改登录 PIN</h2>
<label for="cur">当前 PIN</label>
<input id="cur" type="password" inputmode="numeric" maxlength="32" autocomplete="current-password">
<label for="nxt">新 PIN（4-32 位数字）</label>
<input id="nxt" type="password" inputmode="numeric" maxlength="32" autocomplete="new-password">
<label for="cfm">再输一次新 PIN</label>
<input id="cfm" type="password" inputmode="numeric" maxlength="32" autocomplete="new-password">
<div class="row">
  <button class="primary" id="save">保存新 PIN</button>
  <button id="show">显示输入内容</button>
</div>
<div class="msg" id="pinMsg"></div>

<div class="sep"></div>
<h2>启动器</h2>
<div class="switch"><input type="checkbox" id="splash"> 点启动器时显示进度小窗</div>
<div class="msg" id="splashMsg"></div>

<script>
var pinMsg = document.getElementById('pinMsg');
var splashMsg = document.getElementById('splashMsg');
var shown = false;
function say(el, text, kind) { el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }

document.getElementById('show').addEventListener('click', function () {
  shown = !shown;
  ['cur', 'nxt', 'cfm'].forEach(function (id) { document.getElementById(id).type = shown ? 'text' : 'password'; });
  this.textContent = shown ? '隐藏输入内容' : '显示输入内容';
});

document.getElementById('save').addEventListener('click', function () {
  var cur = document.getElementById('cur').value.trim();
  var nxt = document.getElementById('nxt').value.trim();
  var cfm = document.getElementById('cfm').value.trim();
  if (!/^\d{4,32}$/.test(nxt)) return say(pinMsg, '新 PIN 需要 4-32 位数字', 'err');
  if (nxt !== cfm) return say(pinMsg, '两次输入不一致', 'err');
  if (!cur) return say(pinMsg, '请先输入当前 PIN', 'err');
  var btn = this; btn.disabled = true; say(pinMsg, '正在保存…');
  fetch('/boot-auth/pin/change', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ current: cur, next: nxt, confirm: cfm })
  }).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d } }); })
    .then(function (out) {
      btn.disabled = false;
      if (out.status === 200) {
        document.getElementById('cur').value = '';
        document.getElementById('nxt').value = '';
        document.getElementById('cfm').value = '';
        return say(pinMsg, '已更新，下次开门用新 PIN', 'ok');
      }
      say(pinMsg, out.data.error || ('保存失败（HTTP ' + out.status + '）'), 'err');
    })
    .catch(function () { btn.disabled = false; say(pinMsg, '宿主没有响应', 'err'); });
});

function loadSplash() {
  fetch('/boot-auth/settings', { credentials: 'same-origin' })
    .then(function (r) { return r.json() })
    .then(function (d) { document.getElementById('splash').checked = d.splashEnabled !== false; })
    .catch(function () { say(splashMsg, '读不到设置', 'err'); });
}
document.getElementById('splash').addEventListener('change', function () {
  var on = this.checked;
  fetch('/boot-auth/settings', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ splashEnabled: on })
  }).then(function (d) { say(splashMsg, on ? '已开启：点启动器会显示小窗' : '已关闭：点启动器直接启动', 'ok'); })
    .catch(function () { say(splashMsg, '宿主没有响应', 'err'); });
});
loadSplash();
</script>
</div></body></html>`

  const uiHandler = async (req, res) => {
    if (req.method !== 'GET') return send(res, 405, { error: 'GET only' })
    try {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(SETTINGS_HTML)
    } catch { /* ignore */ }
  }

  const announceHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    let body = {}
    if (req.method === 'POST') {
      try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    }
    const action = String(body.action ?? 'status')
    const version = currentVersion()

    if (action === 'dismiss') {
      const store = readAnnounce()
      store.dismissedFor = version
      store.dismissedAt = new Date().toISOString()
      writeAnnounce(store)
      return send(res, 200, { ...announceSnapshot(version), dismissed: true })
    }

    // 入口检测：说好了装了却不见了（误删、换机器、清理工具），就补一个回来。
    if (action === 'ensure') {
      const before = launcherStatus()
      if (!before.available) return send(res, 409, { ...announceSnapshot(version), error: 'no-launcher-files' })
      if (!before.installed) {
        const result = await runInstaller('install')
        const after = launcherStatus()
        return send(res, 200, { ...announceSnapshot(version), repaired: after.installed, log: result.out.trim().slice(-200) })
      }
      return send(res, 200, { ...announceSnapshot(version), repaired: false })
    }

    send(res, 200, announceSnapshot(version))
  }

  function announceSnapshot(version) {
    const store = readAnnounce()
    const launcher = launcherStatus()
    return {
      version,
      dismissedFor: store.dismissedFor ?? null,
      shouldShow: (store.dismissedFor ?? null) !== version,
      launcherInstalled: launcher.installed,
      launcherAvailable: launcher.available,
    }
  }

  const timingHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    const stage = String(body.stage ?? '').slice(0, 40)
    const ms = Number(body.ms) || 0
    try {
      fs.mkdirSync(DSH_HOME, { recursive: true })
      fs.appendFileSync(path.join(DSH_HOME, 'boot-timing.log'),
        `${new Date().toISOString()}  ${String(ms).padStart(6)}ms  ${stage}\n`)
    } catch { /* logging must never break the gate */ }
    send(res, 200, { ok: true })
  }

  const helloResetHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    const reset = await resetHelloBroker()
    helloNeedsReset = false
    send(res, 200, { ok: true, reset })
  }

  const launcherHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    let body = {}
    if (req.method === 'POST') {
      try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    }
    const action = String(body.action ?? '')
    if (req.method !== 'POST' || action === 'status') return send(res, 200, launcherStatus())

    if (!launcherStatus().available) {
      return send(res, 409, { error: '这个版本里没有启动器文件', ...launcherStatus() })
    }
    if (action !== 'install' && action !== 'uninstall') {
      return send(res, 400, { error: 'action 只能是 install / uninstall' })
    }

    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', LAUNCHER_PS1]
    if (action === 'uninstall') args.push('-Uninstall')
    const result = await new Promise((resolve) => {
      let out = ''
      try {
        const child = spawn('powershell.exe', args, { windowsHide: true })
        child.stdout?.on('data', (chunk) => { out += chunk.toString() })
        child.stderr?.on('data', (chunk) => { out += chunk.toString() })
        child.on('error', (error) => resolve({ code: -1, out: String(error && error.message) }))
        child.on('close', (code) => resolve({ code, out }))
      } catch (error) {
        resolve({ code: -1, out: String(error && error.message) })
      }
    })

    const status = launcherStatus()
    send(res, result.code === 0 ? 200 : 500, {
      ...status,
      action,
      log: result.out.trim().slice(-400),
    })
  }

  // Change the access PIN from inside the app. The point of this endpoint is the
  // failure mode it removes: the old flow forced you out to the gate, where a
  // half-finished change could leave an account nobody can open.
  // 改 PIN 需要第二因素：验证器动态码 / 备份码 / Windows Hello 之一。
  // 通过后发一个 5 分钟的一次性令牌，改完即作废。
  const STEPUP_COOKIE = 'boot_stepup'
  const STEPUP_TTL_MS = 5 * 60 * 1000
  const stepUps = new Map()

  function issueStepUp() {
    const token = crypto.randomBytes(24).toString('hex')
    stepUps.set(token, Date.now() + STEPUP_TTL_MS)
    for (const [key, exp] of stepUps) if (exp < Date.now()) stepUps.delete(key)
    return token
  }

  function cookieValue(req, name) {
    const raw = String(req.headers?.cookie || '')
    for (const part of raw.split(';')) {
      const [k, ...rest] = part.trim().split('=')
      if (k === name) return rest.join('=')
    }
    return null
  }

  function stepUpCookie(req) {
    const token = cookieValue(req, STEPUP_COOKIE)
    if (!token) return null
    const until = stepUps.get(token)
    if (!until || until < Date.now()) { stepUps.delete(token); return null }
    return token
  }

  const stepUpHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method === 'GET') return send(res, 200, { verified: !!stepUpCookie(req) })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }

    if (body.via === 'hello') {
      const probe = await runHello()
      if (!probe.ok) return send(res, 401, { error: 'Windows Hello 没有通过', reason: probe.reason })
      const token = issueStepUp()
      return send(res, 200, { ok: true, via: 'hello' }, {
        'set-cookie': `${STEPUP_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${STEPUP_TTL_MS / 1000}`,
      })
    }

    const code = String(body.code || '').trim()
    if (!code) return send(res, 400, { error: '请输入验证器动态码或备份码' })
    const record = readTotp()
    if (!record) return send(res, 409, { error: '还没有配置验证器' })

    let ok = false
    let via = null
    if (/^\d{6}$/.test(code)) {
      ok = verifyTotpCode(record.secret, code)
      via = 'totp'
    } else {
      const index = matchBackupCode(record.backup, code)
      if (index >= 0) {
        record.backup[index].usedAt = new Date().toISOString()
        writeTotp(record)
        ok = true
        via = 'backup'
      }
    }
    if (!ok) return send(res, 401, { error: '动态码不对' })
    const token = issueStepUp()
    send(res, 200, { ok: true, via }, {
      'set-cookie': `${STEPUP_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${STEPUP_TTL_MS / 1000}`,
    })
  }

  const pinChangeHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    const auth = readAuth()
    if (!auth) return send(res, 409, { error: '还没有设置 PIN' })
    if (!stepUpCookie(req)) {
      return send(res, 401, { error: '请先通过验证器或 Windows Hello 验证', need: 'stepup' })
    }

    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    const next = String(body.next ?? '')
    const confirm = String(body.confirm ?? '')
    const current = String(body.current ?? '')

    if (!/^\d{4,32}$/.test(next)) return send(res, 400, { error: '新 PIN 需要 4-32 位数字' })
    if (next !== confirm) return send(res, 400, { error: '两次输入不一致' })

    // A verification that just happened (PIN / fingerprint / code) is enough;
    // otherwise the caller has to supply the current PIN.
    const fresh = provedAt > 0 && Date.now() - provedAt <= PROOF_TTL_MS
    if (!fresh) {
      if (!current) return send(res, 401, { error: '需要先验证身份', need: 'current' })
      if (!sameHash(hashPin(current, auth.salt), auth.hash)) {
        return send(res, 401, { error: '当前 PIN 不对', need: 'current' })
      }
    }

    const salt = crypto.randomBytes(16).toString('hex')
    writeAuth({
      ...auth,
      salt,
      hash: hashPin(next, salt),
      pinChangedAt: new Date().toISOString(),
    })
    provedAt = 0
    const spent = stepUpCookie(req)
    if (spent) stepUps.delete(spent)
    send(res, 200, { ok: true, via: fresh ? 'verified-session' : 'current-pin' })
  }

  const helloHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    if (helloNeedsReset) {
      helloNeedsReset = false
      const reset = await resetHelloBroker()
      console.error('[boot-handmade] broker reset before retry:', JSON.stringify(reset))
    }
    raisePrompt()
    const result = await runHello()
    if (!result.ok) {
      // Canceled / RetriesExhausted / no-result all mean the session is suspect.
      helloNeedsReset = true
    }
    if (result.ok) {
      // Remember that this machine can actually do it: the value written at
      // enrolment time goes stale when a driver is fixed afterwards.
      const auth = readAuth()
      if (auth && auth.hello !== 'available') writeAuth({ ...auth, hello: 'available' })
      provedAt = Date.now()
      const token = issueSession()
      return send(res, 200, result, {
        'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
      })
    }
    send(res, 401, result)
  }

  // -CheckOnly: asks "can this machine verify a person right now?" without
  // putting a prompt on screen. Lets the gate decide whether to offer the
  // fingerprint entry at all instead of trusting a value from enrolment.
  const helloProbeHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    const result = await runHello(['-CheckOnly'])
    send(res, 200, {
      availability: result.availability ?? 'unknown',
      supported: result.availability === 'Available',
    })
  }

  const oauthHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    send(res, 501, {
      error: 'not_configured',
      detail: '微信 / QQ 登录需要在腾讯开放平台注册应用并拿到 AppID / AppSecret，'
        + '这一步只能由账号主人完成；填好后再接 OAuth 回调即可。',
    })
  }

  const lockHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    const token = sessionOf(req)
    if (token) sessions.delete(token)
    send(res, 200, { ok: true }, {
      'set-cookie': 'boot_auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    })
  }

  // --- email recovery -------------------------------------------------------
  // Forgot the PIN? Mail a 6-digit code to the address in boot-recover.json.
  // Only a salted scrypt hash of the code is kept, in memory, for 5 minutes.

  const recoverStartHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

    const config = readRecoverConfig()

    let body
    try { body = await readBody(req) } catch { body = {} }

    const emailReady = Boolean(recoverDestination(config)) && Boolean(recoverSmtp(config))
    const smsOk = smsReady(config)
    const wantSms = String(body?.channel ?? '') === 'sms'

    // 首选调用方点名的通道，其次邮件，最后短信。
    const channel = (wantSms && smsOk) ? 'sms' : (emailReady ? 'email' : (smsOk ? 'sms' : null))
    if (!channel) {
      return send(res, 503, { error: 'smtp-not-configured', sms: false })
    }

    const now = Date.now()
    while (recoverySends.length && now - recoverySends[0] > 60 * 60 * 1000) recoverySends.shift()
    if (recoverySends.length >= MAX_PER_HOUR) {
      return send(res, 429, { error: 'too-many', retryAfterMs: 60 * 60 * 1000 - (now - recoverySends[0]) })
    }
    const last = recoverySends[recoverySends.length - 1]
    if (last && now - last < RESEND_COOLDOWN_MS) {
      return send(res, 429, { error: 'cooldown', retryAfterMs: RESEND_COOLDOWN_MS - (now - last) })
    }

    const challenge = newChallenge()
    const sent = channel === 'sms'
      ? await sendSms(config, `DeepSeek Harness 验证码：${challenge.code}（5 分钟内有效，仅一次）`)
      : await sendMail(
      config,
      'DeepSeek Harness 解锁验证码',
      [
        '你在 DeepSeek Harness 上申请了「跳过 PIN 锁定」的邮箱验证码。',
        '',
        `验证码：${challenge.code}`,
        '',
        '5 分钟内有效，只能使用一次。验证通过后直接进入，不会改动你的 PIN。',
        '如果不是你本人操作，忽略这封邮件即可——没有验证码就进不去。',
      ].join('\n'),
    )
    if (!sent.ok) return send(res, 502, { error: 'send-failed', detail: sent.detail })

    recoverySends.push(now)
    recoveryChallenge = {
      hash: challenge.hash, salt: challenge.salt,
      expiresAt: challenge.expiresAt, attempts: 0,
    }
    send(res, 200, {
      ok: true,
      channel,
      masked: channel === 'sms' ? maskPhone(config.sms.to) : maskEmail(recoverDestination(config)),
      expiresIn: Math.round(CODE_TTL_MS / 1000),
    })
  }

  const recoverVerifyHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    if (!recoveryChallenge) return send(res, 409, { error: 'no-active-code' })

    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    if (recoveryChallenge.attempts >= MAX_ATTEMPTS) {
      recoveryChallenge = null
      return send(res, 429, { error: 'too-many-attempts' })
    }

    const verdict = checkChallenge(recoveryChallenge, String(body.code ?? ''))
    if (verdict === 'expired') {
      recoveryChallenge = null
      return send(res, 410, { error: 'expired' })
    }
    if (verdict !== 'ok') {
      recoveryChallenge.attempts += 1
      return send(res, 401, {
        error: 'bad-code', remaining: Math.max(0, MAX_ATTEMPTS - recoveryChallenge.attempts),
      })
    }

    recoveryChallenge = null
    // A verified code is a way in, full stop: the PIN is left untouched.
    const token = issueSession()
    send(res, 200, { ok: true, recovery: true }, {
      'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    })
  }

  // --- TOTP (authenticator app) ---------------------------------------------
  // A local shared secret: no mail, no SMS, no provider account. The 6-digit
  // code from the phone's authenticator app is enough to skip a lockout.

  const totpStatusHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    const record = readTotp()
    send(res, 200, {
      configured: Boolean(record),
      backupRemaining: record?.backup?.filter((item) => !item.usedAt).length ?? 0,
    })
  }

  const totpSetupHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    if (readTotp()) return send(res, 409, { error: 'totp-already-configured' })

    const secret = newSecret()
    const codes = newBackupCodes(BACKUP_COUNT)
    writeTotp({
      secret,
      createdAt: new Date().toISOString(),
      backup: codes.map((code) => hashBackupCode(code)),
    })
    // Shown exactly once: the secret goes into the app, the backup codes go on
    // paper. Only scrypt hashes of the backup codes stay on disk.
    send(res, 200, {
      ok: true,
      secret,
      uri: otpauthUri(secret),
      backupCodes: codes,
    })
  }

  const totpVerifyHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    const record = readTotp()
    if (!record) return send(res, 409, { error: 'totp-not-configured' })

    const key = req.socket?.remoteAddress ?? 'local'
    const state = totpFailures.get(key) ?? { count: 0, until: 0 }
    if (state.until > Date.now()) {
      return send(res, 429, { error: 'too-many', lockedUntil: state.until })
    }

    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad body' }) }
    const input = String(body.code ?? '').trim()

    let ok = false
    let via = null
    if (/^\d{6}$/.test(input)) {
      ok = verifyTotpCode(record.secret, input)
      via = 'totp'
    } else if (input) {
      const index = matchBackupCode(record.backup, input)
      if (index >= 0) {
        record.backup[index].usedAt = new Date().toISOString()
        writeTotp(record)
        ok = true
        via = 'backup'
      }
    }

    if (!ok) {
      state.count += 1
      if (state.count >= MAX_FAILURES) {
        state.count = 0
        state.until = Date.now() + LOCKOUT_MS
      }
      totpFailures.set(key, state)
      return send(res, 401, {
        error: 'bad-code', remaining: Math.max(1, MAX_FAILURES - (state.count || MAX_FAILURES)),
      })
    }

    totpFailures.delete(key)
    provedAt = Date.now()
    const token = issueSession()
    send(res, 200, {
      ok: true, via, backupRemaining: record.backup.filter((item) => !item.usedAt).length,
    }, {
      'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    })
  }

  const routes = [
    { path: '/boot-auth/status', handler: statusHandler },
    { path: '/boot-auth/enroll', handler: enrollHandler },
    { path: '/boot-auth/pin', handler: pinHandler },
    { path: '/boot-auth/pin/change', handler: pinChangeHandler },
    { path: '/boot-auth/launcher', handler: launcherHandler },
    { path: '/boot-auth/hello/reset', handler: helloResetHandler },
    { path: '/boot-auth/timing', handler: timingHandler },
    { path: '/boot-auth/announce', handler: announceHandler },
    { path: '/boot-auth/settings', handler: settingsHandler },
    { path: '/boot-auth/ui', handler: uiHandler },
    { path: '/boot-auth/stepup', handler: stepUpHandler },
    { path: '/boot-auth/hello/probe', handler: helloProbeHandler },
    { path: '/boot-auth/hello', handler: helloHandler },
    { path: '/boot-auth/totp/status', handler: totpStatusHandler },
    { path: '/boot-auth/totp/setup', handler: totpSetupHandler },
    { path: '/boot-auth/totp/verify', handler: totpVerifyHandler },
    { path: '/boot-auth/recover/start', handler: recoverStartHandler },
    { path: '/boot-auth/recover/verify', handler: recoverVerifyHandler },
    { path: '/boot-auth/oauth', handler: oauthHandler },
    { path: '/boot-auth/lock', handler: lockHandler },
  ]

  for (const route of routes) {
    try {
      ctx.webServer.register({ name: `boot-handmade${route.path}`, kind: 'exact', path: route.path, handler: route.handler })
    } catch (error) {
      console.error(`[boot-handmade] route ${route.path} skipped:`, error)
    }
  }
}

// 官方设置页入口：注册一个 settings 命名空间，Web 的「设置 → 插件 → 插件配置」
// 会自动为我们生成一个条目和表单（Vision Router、Cappuccin 就是这样出现的）。
//
// 整段都是可选的：任何一步失败都只是"不出现条目"，绝不能影响门本身。
function registerSettingsSection(ctx) {
  // 宿主进程的 console 抓不到，写一行到文件才能事后确认到底有没有注册成功。
  const note = (text) => {
    try {
      fs.mkdirSync(DSH_HOME, { recursive: true })
      fs.appendFileSync(path.join(DSH_HOME, 'boot-settings.log'),
        `${new Date().toISOString()}  ${text}\n`)
    } catch { /* 记不下来也不影响 */ }
  }
  const fail = (why) => {
    console.error('[boot-handmade] settings section skipped:', why)
    note('skipped: ' + why)
  }

  // 插件是 link 安装的，依赖不在自己目录里，裸 import 会 ERR_MODULE_NOT_FOUND。
  // 先在常规位置试，再从各 profile 的 node_modules 里找。
  function loadSchemaLib() {
    return import('@deepseek-ai/schemastery').catch(() => {
      const profiles = path.join(DSH_HOME, 'profiles')
      let dirs = []
      try { dirs = fs.readdirSync(profiles).map((d) => path.join(profiles, d, 'node_modules')) } catch { dirs = [] }
      for (const dir of dirs) {
        try {
          const req = createRequire(path.join(dir, 'index.js'))
          return Promise.resolve(req('@deepseek-ai/schemastery'))
        } catch { /* 换下一个 */ }
      }
      throw new Error('schemastery not found in any profile')
    })
  }

  const pending = loadSchemaLib()

  pending.then((mod) => {
    const z = mod.default ?? mod
    if (!z || typeof z.object !== 'function') return fail('schemastery shape unexpected')

    let Schema
    try {
      Schema = z.object({
        theme: z.union([z.const('auto'), z.const('light'), z.const('dark')]).default('auto'),
        splash: z.boolean().default(true),
        pinCurrent: z.string().description('当前 PIN（更改时必填）').default(''),
        pinNew: z.string().description('新 PIN：4-32 位数字').default(''),
        pinConfirm: z.string().description('再输一次新 PIN').default(''),
      })
    } catch (error) {
      return fail('schema build failed: ' + String(error && error.message))
    }

    try {
      ctx.inject(['settings'], (sctx) => {
        try {
          const scope = sctx.settings.register('boot-auth', Schema, {})
          // 设置页改了值 → 落到 boot-settings.json（启动器和门都读它）
          // readSettings/writeSettings 在 registerRoutes 里，那边拿不到，这里自带一份。
          const settingsFile = () => path.join(DSH_HOME, 'boot-settings.json')
          const readBoot = () => {
            const fallback = { splashEnabled: true, theme: 'auto' }
            try { return { ...fallback, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } }
            catch { return fallback }
          }
          const writeBoot = (value) => {
            try {
              fs.mkdirSync(DSH_HOME, { recursive: true })
              fs.writeFileSync(settingsFile(), JSON.stringify(value, null, 2))
            } catch { /* 写不进去也不该影响门 */ }
          }

          // 配置表单只能存值，改 PIN 是动作：这里在值变化后执行，
          // 并把结果写回 boot-settings.json（表单本身显示不了结果）。
          const tryChangePin = (values) => {
            const nextPin = String(values.pinNew || '').trim()
            const again = String(values.pinConfirm || '').trim()
            const current = String(values.pinCurrent || '').trim()
            if (!nextPin && !again && !current) return false
            if (!nextPin || nextPin !== again) return false
            if (!/^\d{4,32}$/.test(nextPin)) return false

            const store = readBoot()
            // 同样的输入不重复执行（表单没法自己清空）
            const stamp = crypto.createHash('sha256').update(current + '|' + nextPin).digest('hex').slice(0, 16)
            if (store.lastPinRequest === stamp) return false

            let record
            try { record = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) } catch { record = null }
            if (!record) return false

            const same = (pin) => crypto.scryptSync(pin, record.salt, 32).toString('hex') === record.hash
            let via = null
            if (current && same(current)) via = 'current-pin'
            else if (provedAt > 0 && Date.now() - provedAt <= PROOF_TTL_MS) via = 'verified-session'
            if (!via) {
              store.lastPinRequest = stamp
              store.lastPinResult = 'failed: 当前 PIN 不对，或需要先验证一次身份'
              writeBoot(store)
              return true
            }
            const salt = crypto.randomBytes(16).toString('hex')
            const hash = crypto.scryptSync(nextPin, salt, 32).toString('hex')
            const updated = { ...record, salt, hash, pinChangedAt: new Date().toISOString() }
            fs.writeFileSync(AUTH_FILE, JSON.stringify(updated, null, 2))
            provedAt = 0
            store.lastPinRequest = stamp
            store.lastPinResult = 'ok: ' + via + ' at ' + updated.pinChangedAt
            writeBoot(store)
            console.error('[boot-handmade] PIN changed from settings (' + via + ')')
            return true
          }

          const applyValues = () => {
            let values = {}
            try { values = scope.get() || {} } catch { values = {} }
            const next = readBoot()
            if (values.theme === 'auto' || values.theme === 'light' || values.theme === 'dark') {
              next.theme = values.theme
            }
            if (typeof values.splash === 'boolean') next.splashEnabled = values.splash
            writeBoot(next)
            try { tryChangePin(values) } catch (error) {
              console.error('[boot-handmade] pin change from settings failed:', error)
            }
          }
          applyValues()
          if (typeof scope.watch === 'function') scope.watch(applyValues)
          console.error('[boot-handmade] settings section registered')
          note('registered: namespace boot-auth')
        } catch (error) {
          fail('register failed: ' + String(error && error.message))
        }
      })
    } catch (error) {
      fail('inject failed: ' + String(error && error.message))
    }
  }).catch((error) => fail(String(error && (error.code || error.message))))
}

export function apply(ctx) {
  if (typeof ctx?.inject !== 'function') return
  try {
    ctx.inject(['webServer'], (scope) => {
      try {
        registerRoutes(scope)
      } catch (error) {
        console.error('[boot-handmade] routes unavailable:', error)
      }
    })
  } catch (error) {
    console.error('[boot-handmade] webServer injection failed:', error)
  }

  // 用根上下文注册，不能用 webServer 的 scope。
  try {
    registerSettingsSection(ctx)
  } catch (error) {
    console.error('[boot-handmade] settings section unavailable:', error)
  }
}
