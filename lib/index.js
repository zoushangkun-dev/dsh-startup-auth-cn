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
import {
  readTotp, writeTotp, newSecret, otpauthUri, newBackupCodes, hashBackupCode,
  matchBackupCode, verifyCode as verifyTotpCode, BACKUP_COUNT,
} from './totp.js'
import {
  readConfig as readRecoverConfig, destination as recoverDestination, smtp as recoverSmtp,
  maskEmail, newChallenge, checkChallenge, sendMail,
  CODE_TTL_MS, RESEND_COOLDOWN_MS, MAX_PER_HOUR, MAX_ATTEMPTS,
} from './recover.js'

export const name = 'bootHandmade'

export const inject = []

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const AUTH_FILE = path.join(DSH_HOME, 'boot-auth.json')
// Escape hatch for the first releases: while this file exists the gate reports
// itself as already unlocked. Creating it needs no GUI, which is the point —
// a broken lock must never cost more than one file.
const BYPASS_FILE = path.join(DSH_HOME, 'boot-auth-bypass')
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCKOUT_MS = 30 * 1000

const sessions = new Map()          // token -> expiresAt
const failures = new Map()          // remote address -> { count, until }
const recoverySends = []            // timestamps of mails sent, for rate limiting
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
    if (!/^\d{4,8}$/.test(pin)) return send(res, 400, { error: 'PIN 需要 4-8 位数字' })
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
    const token = issueSession()
    send(res, 200, { ok: true }, {
      'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    })
  }

  const helloHandler = async (req, res) => {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'untrusted origin' })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    raisePrompt()
    const result = await runHello()
    if (result.ok) {
      // Remember that this machine can actually do it: the value written at
      // enrolment time goes stale when a driver is fixed afterwards.
      const auth = readAuth()
      if (auth && auth.hello !== 'available') writeAuth({ ...auth, hello: 'available' })
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
    const to = recoverDestination(config)
    if (!to) return send(res, 503, { error: 'recovery-not-configured' })
    if (!recoverSmtp(config)) return send(res, 503, { error: 'smtp-not-configured' })

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
    const sent = await sendMail(
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
      ok: true, channel: 'email', masked: maskEmail(to), expiresIn: Math.round(CODE_TTL_MS / 1000),
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
}
