import { Router } from 'express'
import { Redis } from 'ioredis'
import crypto from 'crypto'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { query } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { sendOtpEmail } from '../services/email.js'

const router = Router()
const redis  = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379')

const ISSUER = 'MediaDL'

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex')
}

function generateBackupCodes(n = 10): { plain: string[]; hashed: { code_hash: string; used: boolean }[] } {
  const plain: string[] = []
  const hashed: { code_hash: string; used: boolean }[] = []
  for (let i = 0; i < n; i++) {
    // 10-char code formatted as XXXXX-XXXXX
    const raw = crypto.randomBytes(5).toString('hex').slice(0, 10)
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`
    plain.push(formatted)
    hashed.push({ code_hash: hashCode(formatted), used: false })
  }
  return { plain, hashed }
}

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/mfa/methods — which verification methods this user has available
// ════════════════════════════════════════════════════════════════════════════
router.get('/methods', requireAuth, async (req, res) => {
  try {
    const rows = await query<{
      email: string; backup_email: string | null; backup_email_verified: number
      totp_enabled: number; mfa_enabled: number; preferred_mfa_method: string
    }>(
      `SELECT email, backup_email, backup_email_verified, totp_enabled, mfa_enabled, preferred_mfa_method
       FROM users WHERE id = ?`, [req.authUser!.id]
    )
    if (!rows.length) { res.status(404).json({ error: 'User not found' }); return }
    const u = rows[0]
    res.json({
      methods: {
        email:        { available: true, value: u.email },
        backup_email: { available: !!u.backup_email && !!u.backup_email_verified, value: u.backup_email },
        totp:         { available: !!u.totp_enabled },
      },
      backupEmailPending: !!u.backup_email && !u.backup_email_verified,
      mfaEnabled:         !!u.mfa_enabled,
      preferred:          u.preferred_mfa_method ?? 'email',
    })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/mfa/preferred — set preferred verification method
router.patch('/preferred', requireAuth, async (req, res) => {
  const { method } = req.body as { method?: string }
  if (!['email', 'backup_email', 'totp'].includes(method ?? '')) {
    res.status(400).json({ error: 'method must be email, backup_email, or totp' }); return
  }
  // Verify the chosen method is actually available
  const rows = await query<{ backup_email_verified: number; totp_enabled: number }>(
    'SELECT backup_email_verified, totp_enabled FROM users WHERE id = ?', [req.authUser!.id]
  )
  const u = rows[0]
  if (method === 'backup_email' && !u?.backup_email_verified) {
    res.status(400).json({ error: 'Backup email not verified' }); return
  }
  if (method === 'totp' && !u?.totp_enabled) {
    res.status(400).json({ error: 'Authenticator app not enabled' }); return
  }
  await query('UPDATE users SET preferred_mfa_method = ? WHERE id = ?', [method, req.authUser!.id])
  res.json({ success: true, preferred: method })
})

// ════════════════════════════════════════════════════════════════════════════
//  BACKUP EMAIL
// ════════════════════════════════════════════════════════════════════════════

// POST /api/mfa/backup-email/send-otp — body {backup_email}
router.post('/backup-email/send-otp', requireAuth, async (req, res) => {
  const userId      = req.authUser!.id
  const backupEmail = String((req.body as any).backup_email ?? '').trim().toLowerCase()

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(backupEmail)) {
    res.status(400).json({ error: 'Invalid email address' }); return
  }
  if (backupEmail === req.authUser!.email.toLowerCase()) {
    res.status(400).json({ error: 'Backup email must differ from your primary email' }); return
  }
  // Ensure not used by another account
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE (email = ? OR backup_email = ?) AND id != ? LIMIT 1',
    [backupEmail, backupEmail, userId]
  )
  if (existing.length) {
    res.status(409).json({ error: 'This email is already in use by another account' }); return
  }

  // Rate limit: 3/hour per user
  const rateKey = `mfa_be_rate:${userId}`
  const count   = await redis.incr(rateKey)
  if (count === 1) await redis.expire(rateKey, 3600)
  if (count > 3) { res.status(429).json({ error: 'Too many requests. Try again later.' }); return }

  const otp = generateOtp()
  // Bind OTP to the specific (user, backupEmail) pair
  await redis.set(`mfa_be:${userId}`, JSON.stringify({ backupEmail, otp }), 'EX', 600)

  try {
    await sendOtpEmail(backupEmail, otp, 'backup_email')
    res.json({ success: true, message: `Verification code sent to ${backupEmail}` })
  } catch (e: any) {
    res.status(500).json({ error: `Failed to send code: ${e.message}` })
  }
})

// POST /api/mfa/backup-email/verify — body {otp}
router.post('/backup-email/verify', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const otp    = String((req.body as any).otp ?? '').trim()

  const raw = await redis.get(`mfa_be:${userId}`)
  if (!raw) { res.status(400).json({ error: 'No pending verification or code expired' }); return }

  const { backupEmail, otp: stored } = JSON.parse(raw) as { backupEmail: string; otp: string }
  if (otp !== stored) { res.json({ valid: false, error: 'Invalid code' }); return }

  await redis.del(`mfa_be:${userId}`)
  await query(
    'UPDATE users SET backup_email = ?, backup_email_verified = 1 WHERE id = ?',
    [backupEmail, userId]
  )
  res.json({ valid: true, backup_email: backupEmail })
})

// DELETE /api/mfa/backup-email — remove backup email
router.delete('/backup-email', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  await query(
    `UPDATE users SET backup_email = NULL, backup_email_verified = 0,
       preferred_mfa_method = IF(preferred_mfa_method = 'backup_email', 'email', preferred_mfa_method)
     WHERE id = ?`, [userId]
  )
  await redis.del(`mfa_be:${userId}`)
  res.json({ success: true })
})

// ════════════════════════════════════════════════════════════════════════════
//  TOTP (authenticator app)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/mfa/totp/setup — generate a new secret + QR. Not enabled until verified.
router.post('/totp/setup', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const email  = req.authUser!.email

  // Block if already enabled (must disable first)
  const rows = await query<{ totp_enabled: number }>('SELECT totp_enabled FROM users WHERE id = ?', [userId])
  if (rows[0]?.totp_enabled) { res.status(400).json({ error: 'Authenticator already enabled. Disable it first.' }); return }

  const secret      = authenticator.generateSecret()
  const otpauthUrl  = authenticator.keyuri(email, ISSUER, secret)
  // Stash pending secret in Redis (10 min) — only persisted to DB once verified
  await redis.set(`mfa_totp_pending:${userId}`, secret, 'EX', 600)

  try {
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 })
    res.json({ secret, otpauthUrl, qr: qrDataUrl })
  } catch (e: any) {
    res.status(500).json({ error: `Failed to generate QR: ${e.message}` })
  }
})

// POST /api/mfa/totp/enable — body {code}. Verifies the pending secret, persists + returns backup codes.
router.post('/totp/enable', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const code   = String((req.body as any).code ?? '').trim()

  const secret = await redis.get(`mfa_totp_pending:${userId}`)
  if (!secret) { res.status(400).json({ error: 'Setup expired. Start again.' }); return }

  const ok = authenticator.verify({ token: code, secret })
  if (!ok) { res.json({ valid: false, error: 'Invalid code. Check your authenticator app.' }); return }

  const { plain, hashed } = generateBackupCodes(10)
  await query(
    `UPDATE users SET totp_secret = ?, totp_enabled = 1, mfa_enabled = 1,
       totp_backup_codes = ?, preferred_mfa_method = 'totp' WHERE id = ?`,
    [secret, JSON.stringify(hashed), userId]
  )
  await redis.del(`mfa_totp_pending:${userId}`)
  res.json({ valid: true, backupCodes: plain })
})

// POST /api/mfa/totp/verify — body {code}. Verifies a live TOTP code (step-up auth).
router.post('/totp/verify', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const code   = String((req.body as any).code ?? '').trim()

  const rows = await query<{ totp_secret: string | null; totp_enabled: number }>(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [userId]
  )
  const u = rows[0]
  if (!u?.totp_enabled || !u.totp_secret) { res.status(400).json({ error: 'Authenticator not enabled' }); return }

  const ok = authenticator.verify({ token: code, secret: u.totp_secret })
  res.json({ valid: ok, ...(ok ? {} : { error: 'Invalid code' }) })
})

// POST /api/mfa/totp/backup-code — body {code}. Consumes a one-time recovery code.
router.post('/totp/backup-code', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const code   = String((req.body as any).code ?? '').trim()

  const rows = await query<{ totp_backup_codes: string | null }>(
    'SELECT totp_backup_codes FROM users WHERE id = ?', [userId]
  )
  const list: { code_hash: string; used: boolean }[] = rows[0]?.totp_backup_codes
    ? JSON.parse(rows[0].totp_backup_codes) : []

  const target = hashCode(code)
  const match  = list.find(c => c.code_hash === target && !c.used)
  if (!match) { res.json({ valid: false, error: 'Invalid or already-used recovery code' }); return }

  match.used = true
  await query('UPDATE users SET totp_backup_codes = ? WHERE id = ?', [JSON.stringify(list), userId])
  const remaining = list.filter(c => !c.used).length
  res.json({ valid: true, remaining })
})

// POST /api/mfa/totp/regenerate-codes — body {code}. Re-issues recovery codes.
router.post('/totp/regenerate-codes', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const code   = String((req.body as any).code ?? '').trim()

  const rows = await query<{ totp_secret: string | null; totp_enabled: number }>(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [userId]
  )
  const u = rows[0]
  if (!u?.totp_enabled || !u.totp_secret) { res.status(400).json({ error: 'Authenticator not enabled' }); return }
  if (!authenticator.verify({ token: code, secret: u.totp_secret })) {
    res.json({ valid: false, error: 'Invalid code' }); return
  }

  const { plain, hashed } = generateBackupCodes(10)
  await query('UPDATE users SET totp_backup_codes = ? WHERE id = ?', [JSON.stringify(hashed), userId])
  res.json({ valid: true, backupCodes: plain })
})

// POST /api/mfa/totp/disable — body {code}. Verifies a TOTP code, then disables.
router.post('/totp/disable', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const code   = String((req.body as any).code ?? '').trim()

  const rows = await query<{ totp_secret: string | null; totp_enabled: number; backup_email_verified: number }>(
    'SELECT totp_secret, totp_enabled, backup_email_verified FROM users WHERE id = ?', [userId]
  )
  const u = rows[0]
  if (!u?.totp_enabled || !u.totp_secret) { res.status(400).json({ error: 'Authenticator not enabled' }); return }

  if (!authenticator.verify({ token: code, secret: u.totp_secret })) {
    res.json({ valid: false, error: 'Invalid code — cannot disable' }); return
  }

  // Falls back to backup_email if verified, else email.
  const fallback = u.backup_email_verified ? 'backup_email' : 'email'
  await query(
    `UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL,
       mfa_enabled = IF(? = 'email', 0, mfa_enabled),
       preferred_mfa_method = ? WHERE id = ?`,
    [fallback, fallback, userId]
  )
  res.json({ valid: true })
})

// ════════════════════════════════════════════════════════════════════════════
//  CHALLENGE — step-up verification at login. User chooses a method.
// ════════════════════════════════════════════════════════════════════════════

// POST /api/mfa/challenge/send — body {method: 'email'|'backup_email'}
// (totp needs no send — codes come from the app)
router.post('/challenge/send', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const method = String((req.body as any).method ?? '')

  if (!['email', 'backup_email'].includes(method)) {
    res.status(400).json({ error: 'method must be email or backup_email' }); return
  }

  const rows = await query<{ email: string; backup_email: string | null; backup_email_verified: number }>(
    'SELECT email, backup_email, backup_email_verified FROM users WHERE id = ?', [userId]
  )
  const u = rows[0]
  const target = method === 'backup_email' ? u?.backup_email : u?.email
  if (method === 'backup_email' && !u?.backup_email_verified) {
    res.status(400).json({ error: 'Backup email not verified' }); return
  }
  if (!target) { res.status(400).json({ error: 'No address for this method' }); return }

  // Rate limit
  const rateKey = `mfa_chal_rate:${userId}`
  const count   = await redis.incr(rateKey)
  if (count === 1) await redis.expire(rateKey, 3600)
  if (count > 5) { res.status(429).json({ error: 'Too many requests. Try again later.' }); return }

  const otp = generateOtp()
  await redis.set(`mfa_chal:${userId}:${method}`, otp, 'EX', 600)
  try {
    await sendOtpEmail(target, otp, 'mfa')
    res.json({ success: true, sentTo: target.replace(/(.{2}).*(@.*)/, '$1•••$2') })
  } catch (e: any) {
    res.status(500).json({ error: `Failed to send code: ${e.message}` })
  }
})

// POST /api/mfa/challenge/verify — body {method, code}
router.post('/challenge/verify', requireAuth, async (req, res) => {
  const userId = req.authUser!.id
  const method = String((req.body as any).method ?? '')
  const code   = String((req.body as any).code ?? '').trim()

  if (method === 'totp') {
    const rows = await query<{ totp_secret: string | null; totp_enabled: number }>(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [userId]
    )
    const u = rows[0]
    if (!u?.totp_enabled || !u.totp_secret) { res.status(400).json({ error: 'Authenticator not enabled' }); return }
    // Allow either a live TOTP code or a one-time recovery code
    let ok = authenticator.verify({ token: code, secret: u.totp_secret })
    if (!ok) {
      const bcRows = await query<{ totp_backup_codes: string | null }>(
        'SELECT totp_backup_codes FROM users WHERE id = ?', [userId]
      )
      const list: { code_hash: string; used: boolean }[] = bcRows[0]?.totp_backup_codes ? JSON.parse(bcRows[0].totp_backup_codes) : []
      const match = list.find(c => c.code_hash === hashCode(code) && !c.used)
      if (match) { match.used = true; await query('UPDATE users SET totp_backup_codes = ? WHERE id = ?', [JSON.stringify(list), userId]); ok = true }
    }
    res.json({ valid: ok, ...(ok ? {} : { error: 'Invalid code' }) })
    return
  }

  if (['email', 'backup_email'].includes(method)) {
    const key    = `mfa_chal:${userId}:${method}`
    const stored = await redis.get(key)
    if (!stored || stored !== code) { res.json({ valid: false, error: 'Invalid or expired code' }); return }
    await redis.del(key)
    res.json({ valid: true })
    return
  }

  res.status(400).json({ error: 'Invalid method' })
})

export default router
