'use client'
// Firebase FCM — opt-in. Requires NEXT_PUBLIC_FIREBASE_* env vars.
// If vars are missing, every function is a no-op and returns null.

function isConfigured(): boolean {
  return typeof window !== 'undefined' &&
    !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
       process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
       process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)
}

let _messaging: any = null

async function getMessagingInstance(): Promise<any> {
  if (!isConfigured()) return null
  if (_messaging) return _messaging
  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging }           = await import('firebase/messaging')
    const cfg = {
      apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
    const app = getApps().length ? getApps()[0] : initializeApp(cfg)
    _messaging = getMessaging(app)
    return _messaging
  } catch (e: any) {
    console.warn('[fcm] init failed:', e.message)
    return null
  }
}

/** Request permission and return the FCM registration token. Returns null if
 *  permission denied, Firebase not configured, or any error. */
export async function requestFCMToken(): Promise<string | null> {
  const m = await getMessagingInstance()
  if (!m) return null
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('[fcm] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set')
    return null
  }
  try {
    const { getToken } = await import('firebase/messaging')
    const sw = await navigator.serviceWorker.ready
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: sw })
    return token || null
  } catch (e: any) {
    console.warn('[fcm] getToken failed:', e.message)
    return null
  }
}

/** Set up a foreground message handler (fires when the tab is open). */
export async function onForegroundMessage(
  handler: (payload: { notification?: { title?: string; body?: string }; data?: any }) => void
): Promise<() => void> {
  const m = await getMessagingInstance()
  if (!m) return () => {}
  const { onMessage } = await import('firebase/messaging')
  const unsub = onMessage(m, handler)
  return unsub
}

export function isFCMConfigured(): boolean {
  return isConfigured()
}
