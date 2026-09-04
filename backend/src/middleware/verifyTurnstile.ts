import type { Request, Response, NextFunction } from 'express'
import axios from 'axios'

/**
 * Cloudflare Turnstile verification.
 *
 * Disabled unless TURNSTILE_SECRET_KEY is set — so local / self-hosted runs
 * work with no CAPTCHA at all. When a secret is present, every guarded request
 * must carry a Turnstile token (body `turnstileToken` or header
 * `cf-turnstile-response`) that passes Cloudflare's siteverify check.
 */
const SECRET = process.env.TURNSTILE_SECRET_KEY?.trim()
const INTERNAL_KEY = process.env.INTERNAL_API_KEY?.trim()
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const turnstileEnabled = !!SECRET

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  if (!SECRET) { next(); return }

  // Trusted server-to-server callers (the Telegram bot) present a shared secret
  // and skip the human-verification challenge.
  if (INTERNAL_KEY && req.get('x-internal-key') === INTERNAL_KEY) { next(); return }

  const token: string | undefined =
    (req.body && typeof req.body.turnstileToken === 'string' && req.body.turnstileToken) ||
    req.get('cf-turnstile-response') ||
    undefined

  if (!token) {
    res.status(403).json({ error: 'Human verification required. Please complete the CAPTCHA and try again.' })
    return
  }

  try {
    const form = new URLSearchParams({ secret: SECRET, response: token })
    const ip = req.get('cf-connecting-ip') || req.ip
    if (ip) form.append('remoteip', ip)

    const { data } = await axios.post(SITEVERIFY, form, {
      timeout: 10_000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    if (!data?.success) {
      res.status(403).json({
        error: 'Human verification failed. Please refresh and try again.',
        codes: data?.['error-codes'],
      })
      return
    }
    next()
  } catch {
    res.status(502).json({ error: 'Verification service is temporarily unavailable. Try again shortly.' })
  }
}
