// TOTP (RFC 6238) for dsh-boot-handmade.
//
// The gate can ask for the 6-digit code from an authenticator app instead of
// the PIN. Everything is local: a random secret lives in
// $DSH_HOME/boot-totp.json, the code is computed here, and nothing is sent
// anywhere -- no mail provider, no SMS gateway, no account to register.
//
// Backup codes: 8 single-use codes, stored only as salted scrypt hashes, so a
// lost phone does not mean a lost machine.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const TOTP_FILE = path.join(DSH_HOME, 'boot-totp.json')

export const DIGITS = 6
export const STEP_SECONDS = 30
export const WINDOW = 1              // accept one step either side for clock drift
export const BACKUP_COUNT = 8

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes = []
  for (const ch of clean) {
    const index = ALPHABET.indexOf(ch)
    if (index < 0) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function newSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes))
}

function hotp(key, counter) {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const value = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  return String(value % 10 ** DIGITS).padStart(DIGITS, '0')
}

export function codeAt(secret, whenMs = Date.now()) {
  const key = base32Decode(secret)
  return hotp(key, Math.floor(whenMs / 1000 / STEP_SECONDS))
}

// Compares without leaking timing, and tolerates one step of clock drift.
export function verifyCode(secret, input, whenMs = Date.now()) {
  const given = String(input ?? '').replace(/\D/g, '')
  if (given.length !== DIGITS) return false
  const step = Math.floor(whenMs / 1000 / STEP_SECONDS)
  let ok = false
  for (let delta = -WINDOW; delta <= WINDOW; delta++) {
    const expected = hotp(base32Decode(secret), step + delta)
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) ok = true
  }
  return ok
}

// "ABCD-EFGH"; easy to read off paper.
export function newBackupCodes(count = BACKUP_COUNT) {
  const codes = []
  while (codes.length < count) {
    const raw = base32Encode(crypto.randomBytes(5)).slice(0, 8)
    const pretty = `${raw.slice(0, 4)}-${raw.slice(4)}`
    if (!codes.includes(pretty)) codes.push(pretty)
  }
  return codes
}

export function hashBackupCode(code) {
  const salt = crypto.randomBytes(16).toString('hex')
  const normal = String(code).toUpperCase().replace(/[^A-Z2-7]/g, '')
  const hash = crypto.scryptSync(normal, Buffer.from(salt, 'hex'), 32).toString('hex')
  return { salt, hash }
}

// Returns the index of the matching unused backup code, or -1.
export function matchBackupCode(records, code) {
  const normal = String(code).toUpperCase().replace(/[^A-Z2-7]/g, '')
  if (!normal || !Array.isArray(records)) return -1
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (!record || record.usedAt) continue
    const expected = Buffer.from(record.hash, 'hex')
    const given = crypto.scryptSync(normal, Buffer.from(record.salt, 'hex'), 32)
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return index
  }
  return -1
}

export function readTotp() {
  try {
    const parsed = JSON.parse(fs.readFileSync(TOTP_FILE, 'utf8'))
    return parsed && typeof parsed.secret === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function writeTotp(record) {
  fs.mkdirSync(DSH_HOME, { recursive: true })
  fs.writeFileSync(TOTP_FILE, JSON.stringify(record, null, 2), 'utf8')
}

export function otpauthUri(secret, account = 'DeepSeek Harness') {
  const issuer = 'DeepSeek Harness'
  const label = encodeURIComponent(`${issuer}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
}
