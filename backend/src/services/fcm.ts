import type { App } from 'firebase-admin/app'

// Firebase Admin is opt-in: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID
const SA_JSON   = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? ''
const PROJECT   = process.env.FIREBASE_PROJECT_ID ?? ''
const ENABLED   = !!(SA_JSON || PROJECT)

let _app: App | null = null

function getApp(): App | null {
  if (!ENABLED) return null
  if (_app) return _app
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    if (getApps().length > 0) { _app = getApps()[0]; return _app }
    if (SA_JSON) {
      const sa = JSON.parse(SA_JSON)
      _app = initializeApp({ credential: cert(sa) })
    } else {
      _app = initializeApp({ projectId: PROJECT })
    }
    console.log('[fcm] Firebase Admin initialized')
    return _app
  } catch (e: any) {
    console.error('[fcm] init failed:', e.message)
    return null
  }
}

export function isFcmEnabled() { return ENABLED }

export async function sendPush(opts: {
  token:   string
  title:   string
  body:    string
  url?:    string
  icon?:   string
  tag?:    string
  data?:   Record<string, string>
}): Promise<boolean> {
  const app = getApp()
  if (!app) return false
  try {
    const { getMessaging } = require('firebase-admin/messaging')
    const messaging = getMessaging(app)
    await messaging.send({
      token: opts.token,
      notification: {
        title: opts.title,
        body:  opts.body,
        imageUrl: opts.icon ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/logo.svg`,
      },
      webpush: {
        fcmOptions: { link: opts.url ?? '/' },
        notification: {
          icon:  opts.icon ?? '/logo.svg',
          badge: '/logo.svg',
          tag:   opts.tag ?? 'mediadl',
        },
      },
      data: opts.data ?? {},
    })
    return true
  } catch (e: any) {
    console.error('[fcm] send failed:', e.message)
    return false
  }
}

// ── Token store (Redis) ───────────────────────────────────────────────────────
import { redisConnection } from '../workers/downloadWorker.js'

const KEY_PREFIX = 'fcm:token:'
const TTL_SEC    = 60 * 60 * 24 * 90 // 90 days

export async function saveToken(userId: string, token: string): Promise<void> {
  if (!userId || !token) return
  await redisConnection.set(`${KEY_PREFIX}${userId}`, token, 'EX', TTL_SEC)
}

export async function getToken(userId: string): Promise<string | null> {
  if (!userId) return null
  return redisConnection.get(`${KEY_PREFIX}${userId}`)
}

export async function removeToken(userId: string): Promise<void> {
  await redisConnection.del(`${KEY_PREFIX}${userId}`)
}

export async function notifyUser(userId: string, title: string, body: string, url?: string): Promise<void> {
  if (!ENABLED) return
  const token = await getToken(userId)
  if (!token) return
  await sendPush({ token, title, body, url })
}
