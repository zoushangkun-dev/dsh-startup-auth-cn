// Email recovery for dsh-boot-handmade.
//
// When the PIN is forgotten the gate offers "忘记 PIN · 邮箱验证码救援". The host
// generates a 6-digit code, mails it with the system curl.exe (SMTPS), and keeps
// only a salted scrypt hash of it in memory. Codes live 5 minutes, work once,
// and are rate limited to one a minute / three an hour.
//
// Configuration lives next to the PIN in $DSH_HOME/boot-recover.json:
// {
//   "email": {
//     "to": "someone@example.com",
//     "smtp": { "host": "smtp.126.com", "port": 465,
//               "username": "someone@126.com", "password": "<app password>" }
//   }
// }
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
export const CONFIG_FILE = path.join(DSH_HOME, 'boot-recover.json')

export const CODE_TTL_MS = 5 * 60 * 1000
export const RESEND_COOLDOWN_MS = 60 * 1000
export const MAX_PER_HOUR = 3
export const MAX_ATTEMPTS = 5

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    return null
  }
}

export function destination(config) {
  const to = config?.email?.to
  return typeof to === 'string' && /^[^\s@]+@[^\s@]+$/.test(to.trim()) ? to.trim() : null
}

export function smtp(config) {
  const s = config?.email?.smtp
  if (!s || !s.host || !s.username || !s.password) return null
  return {
    host: String(s.host),
    port: Number(s.port) || 465,
    username: String(s.username),
    password: String(s.password),
    timeoutMs: Number(s.timeoutMs) || 25000,
  }
}

export function maskPhone(number) {
  const digits = String(number || '').replace(/[^0-9]/g, '')
  if (digits.length < 7) return '***'
  return digits.slice(0, 3) + '****' + digits.slice(-4)
}

export function smsReady(config) {
  const sms = config?.sms
  if (!sms || sms.provider !== 'twilio') return false
  return Boolean(sms.accountSid && sms.authToken && sms.from && sms.to)
}

// Twilio 的 REST API：一个 HTTPS POST + Basic Auth，不引 SDK。
export function sendSms(config, text) {
  return new Promise((resolve) => {
    const sms = config?.sms
    if (!smsReady(config)) return resolve({ ok: false, detail: 'sms-not-configured' })

    const body = new URLSearchParams({ To: sms.to, From: sms.from, Body: text })
    const auth = Buffer.from(`${sms.accountSid}:${sms.authToken}`, 'utf8').toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sms.accountSid)}/Messages.json`

    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }).then(async (res) => {
      if (res.ok) return resolve({ ok: true })
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      resolve({ ok: false, detail: `twilio ${res.status}: ${detail}` })
    }).catch((error) => resolve({ ok: false, detail: error.message }))
  })
}

export function maskEmail(address) {
  const at = String(address).indexOf('@')
  if (at <= 0) return '***'
  const name = address.slice(0, at)
  const domain = address.slice(at)
  const head = name.slice(0, 1)
  return head + '***' + domain
}

export function newChallenge(ttlMs = CODE_TTL_MS) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(code, Buffer.from(salt, 'hex'), 32).toString('hex')
  return { code, hash, salt, expiresAt: Date.now() + ttlMs }
}

// 'ok' | 'expired' | 'mismatch'
export function checkChallenge(challenge, code) {
  if (!challenge) return 'mismatch'
  if (Date.now() > challenge.expiresAt) return 'expired'
  const want = Buffer.from(challenge.hash, 'hex')
  const given = crypto.scryptSync(String(code), Buffer.from(challenge.salt, 'hex'), 32)
  if (given.length !== want.length) return 'mismatch'
  return crypto.timingSafeEqual(given, want) ? 'ok' : 'mismatch'
}

function message({ from, to, subject, text }) {
  const b64 = (value) => Buffer.from(value, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n')
  const head = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].join('\r\n')
  return `${head}\r\n\r\n${b64(text)}\r\n`
}

// Uses the curl.exe that ships with Windows 10+, so the plugin needs no
// dependency and no mail library.
export function sendMail(config, subject, text) {
  return new Promise((resolve) => {
    const smtpConfig = smtp(config)
    const to = destination(config)
    if (!smtpConfig || !to) return resolve({ ok: false, detail: 'smtp-not-configured' })

    const curl = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'curl.exe')
    if (!fs.existsSync(curl)) return resolve({ ok: false, detail: 'curl-missing' })

    const eml = path.join(DSH_HOME, `boot-recover-${process.pid}-${Date.now()}.eml`)
    try {
      fs.mkdirSync(DSH_HOME, { recursive: true })
      fs.writeFileSync(eml, message({ from: smtpConfig.username, to, subject, text }))
    } catch (error) {
      return resolve({ ok: false, detail: 'write-failed: ' + error.message })
    }

    const args = [
      '-sS', '--max-time', String(Math.round(smtpConfig.timeoutMs / 1000)),
      '--url', `smtps://${smtpConfig.host}:${smtpConfig.port}`,
      '--user', `${smtpConfig.username}:${smtpConfig.password}`,
      '--mail-from', smtpConfig.username,
      '--mail-rcpt', to,
      '--upload-file', eml,
    ]
    const child = spawn(curl, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      try { fs.unlinkSync(eml) } catch { /* temp file */ }
      resolve(result)
    }
    child.stderr.on('data', (chunk) => { err = (err + chunk.toString()).slice(-600) })
    child.once('error', (error) => finish({ ok: false, detail: error.message }))
    child.once('close', (code) => {
      finish(code === 0 ? { ok: true } : { ok: false, detail: err.trim() || `curl exit ${code}` })
    })
  })
}
