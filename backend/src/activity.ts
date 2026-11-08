// Tracks the last time a real client (Telegram bot, web UI) used the API.
// deploy/idle-shutdown.sh reads it via GET /api/jobs/stats?probe=idle so the
// EC2 instance never stops shortly after someone used it — e.g. while the bot
// is still uploading a finished file to Telegram, or after a quick job that
// started and finished between two 10-minute idle checks.
import type { RequestHandler } from 'express'

let lastActivityAt = Date.now() // a fresh (re)start counts as activity

export const trackActivity: RequestHandler = (req, _res, next) => {
  // The idle checker's own poll must not count as activity.
  if (req.query.probe !== 'idle') lastActivityAt = Date.now()
  next()
}

export function idleSeconds(): number {
  return Math.floor((Date.now() - lastActivityAt) / 1000)
}
