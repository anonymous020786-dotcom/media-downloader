import 'dotenv/config'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// The bot is normally launched from the repo root (`npm run dev:bot`), so
// `dotenv/config` above already loads the root `.env`. When it is started from
// inside `telegram-bot/` instead, also pull in the repo-root file explicitly.
const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '../../.env') })
dotenv.config({ path: path.resolve(here, '../.env') })

function bool(v: string | undefined, dflt = false): boolean {
  if (v == null || v === '') return dflt
  return /^(1|true|yes|on)$/i.test(v.trim())
}

function idList(v: string | undefined): number[] {
  return (v ?? '')
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? '').trim()
if (!BOT_TOKEN) {
  console.error(
    '[bot] TELEGRAM_BOT_TOKEN is not set.\n' +
    '      Create a bot with @BotFather, then add to the repo-root .env:\n' +
    '        TELEGRAM_BOT_TOKEN=123456:ABC-your-token\n' +
    '        TELEGRAM_ALLOWED_USERS=<your numeric telegram id>\n',
  )
  process.exit(1)
}

const apiRoot = (process.env.TELEGRAM_API_ROOT ?? '').trim() || undefined

/** First non-internal IPv4 — used so "too big for Telegram" links open on a
 *  phone that's on the same Wi-Fi as this machine (localhost:4000 won't). */
function lanIPv4(): string | undefined {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address
    }
  }
  return undefined
}

const backendUrl = (process.env.BOT_BACKEND_URL ?? process.env.BACKEND_URL ?? 'http://localhost:4000')
  .trim().replace(/\/$/, '')

let publicBaseUrl = (process.env.BOT_PUBLIC_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? '')
  .trim().replace(/\/$/, '')
if (!publicBaseUrl && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(backendUrl)) {
  const ip = lanIPv4()
  if (ip) {
    publicBaseUrl = backendUrl.replace(/(localhost|127\.0\.0\.1)/, ip)
    console.log(`[bot] over-limit download links will use ${publicBaseUrl} (LAN). Set BOT_PUBLIC_BASE_URL to override.`)
  }
}

export const config = {
  botToken: BOT_TOKEN,
  /** Custom Bot API server (e.g. a local telegram-bot-api). Lifts the 50 MB cap to 2 GB. */
  apiRoot,
  /** Numeric Telegram user ids allowed to use the bot. Empty = nobody (unless allowAll). */
  allowedUsers: idList(process.env.TELEGRAM_ALLOWED_USERS),
  /** Admin-only ids for destructive/global actions. Falls back to allowedUsers. */
  admins: idList(process.env.TELEGRAM_ADMINS),
  /** Open the bot to everyone. Dangerous on a shared machine — off by default. */
  allowAll: bool(process.env.TELEGRAM_ALLOW_ALL, false),

  /** MediaDL Express backend. */
  backendUrl,
  /** Shared secret that lets the bot bypass Turnstile on the backend (optional). */
  internalKey: (process.env.INTERNAL_API_KEY ?? process.env.BOT_INTERNAL_KEY ?? '').trim(),
  /** Base URL for download links handed to chat — explicit env, else the LAN IP. */
  publicBaseUrl,

  /** Largest file (MB) the bot will upload to Telegram. Bigger files are sent as a link. */
  maxUploadMb: Number(process.env.TELEGRAM_MAX_UPLOAD_MB ?? (apiRoot ? 1950 : 49)),

  /**
   * How finished files reach the chat:
   *   auto   — try to upload, fall back to a link if the upload stalls (default)
   *   link   — never upload, always send a link (use when your ISP throttles
   *            Telegram uploads — very common; symptom is downloads that never
   *            "show up")
   *   upload — always upload, never fall back
   */
  delivery: (['auto', 'link', 'upload'].includes((process.env.TELEGRAM_DELIVERY ?? '').trim())
    ? process.env.TELEGRAM_DELIVERY!.trim()
    : 'auto') as 'auto' | 'link' | 'upload',
  /** Seconds to wait for one upload before falling back to a link (auto mode). */
  uploadTimeoutSec: Number(process.env.TELEGRAM_UPLOAD_TIMEOUT_SEC ?? 45),

  /** Default download options applied when the user hasn't overridden them via /settings. */
  defaults: {
    quality: (process.env.BOT_DEFAULT_QUALITY ?? 'best').trim(),
    audioFormat: (process.env.BOT_DEFAULT_AUDIO_FORMAT ?? 'mp3').trim(),
    videoFormat: (process.env.BOT_DEFAULT_VIDEO_FORMAT ?? 'mp4').trim(),
  },
}

export function isAllowed(userId: number | undefined): boolean {
  if (config.allowAll) return true
  if (!userId) return false
  return config.allowedUsers.includes(userId)
}

export function isAdmin(userId: number | undefined): boolean {
  if (!userId) return false
  if (config.admins.length) return config.admins.includes(userId)
  // No explicit admin list → every allowed user is an admin (single-user local setup).
  return isAllowed(userId)
}

export function fileLink(jobId: string, filename?: string): string {
  const base = config.publicBaseUrl || config.backendUrl
  return filename
    ? `${base}/api/files/${jobId}/${encodeURIComponent(filename)}`
    : `${base}/api/files/${jobId}/zip`
}

/** Rewrite a backend-issued link's host to one the user's device can reach. */
export function reachable(url: string): string {
  const base = config.publicBaseUrl || config.backendUrl
  try {
    const u = new URL(url)
    const b = new URL(base)
    u.protocol = b.protocol; u.host = b.host
    return u.toString()
  } catch { return url }
}
