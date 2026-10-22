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

function runHello() {
  return new Promise((resolve) => {
    const script = path.join(PACKAGE_ROOT, 'hello.ps1')
    if (!fs.existsSync(script)) return resolve({ ok: false, reason: 'helper-missing' })
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows',
      'System32/WindowsPowerShell/v1.0/powershell.exe')
    const child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
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
    const result = await runHello()
    if (result.ok) {
      const token = issueSession()
      return send(res, 200, result, {
        'set-cookie': `boot_auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
      })
    }
    send(res, 401, result)
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

  const routes = [
    { path: '/boot-auth/status', handler: statusHandler },
    { path: '/boot-auth/enroll', handler: enrollHandler },
    { path: '/boot-auth/pin', handler: pinHandler },
    { path: '/boot-auth/hello', handler: helloHandler },
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
