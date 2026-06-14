import { Router } from 'express'
import { Redis } from 'ioredis'
import { sendOtpEmail } from '../services/email.js'

const router = Router()
const redis  = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379')

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// POST /api/otp/send
router.post('/send', async (req, res) => {
  const { email, type } = req.body as { email?: string; type?: 'verify' | 'reset' | 'login' }

  if (!email || !type) {
    res.status(400).json({ error: 'email and type are required' }); return
  }
  if (!['verify', 'reset', 'login'].includes(type)) {
    res.status(400).json({ error: 'type must be verify, reset, or login' }); return
  }

  // Rate limit: max 3 OTPs per hour per email
  const rateKey = `otp_rate:${email}`
  const count   = await redis.incr(rateKey)
  if (count === 1) await redis.expire(rateKey, 3600)
  if (count > 3) {
    res.status(429).json({ error: 'Too many OTP requests. Try again later.' }); return
  }

  const otp = generateOtp()
  const key = `otp:${type}:${email}`
  await redis.set(key, otp, 'EX', 600)

  try {
    await sendOtpEmail(email, otp, type)
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: `Failed to send OTP: ${e.message}` })
  }
})

// POST /api/otp/verify
router.post('/verify', async (req, res) => {
  const { email, otp, type } = req.body as { email?: string; otp?: string; type?: string }

  if (!email || !otp || !type) {
    res.status(400).json({ error: 'email, otp, and type are required' }); return
  }

  const key    = `otp:${type}:${email}`
  const stored = await redis.get(key)

  if (!stored || stored !== String(otp)) {
    res.json({ valid: false, error: 'Invalid or expired OTP' }); return
  }

  await redis.del(key)
  res.json({ valid: true })
})

export default router
