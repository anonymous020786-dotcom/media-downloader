const CACHE = 'mediadl-v2'
// Only precache truly public, static shells. Never precache auth-gated pages
// (e.g. /download, /account) — they must always re-validate with the server.
const STATIC = [
  '/offline',
]

// Install — cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC).catch(() => {}))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy:
//   API / SSE / auth     → network-only (never cache — avoids stale authed pages)
//   _next/static         → cache-first (immutable build assets)
//   page navigations     → network-only, fall back to /offline when truly offline
//   other static GETs    → network, fall back to cache
self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = request.url

  // Never intercept API, SSE, auth callbacks, or external URLs.
  if (url.includes('/api/') || url.includes('/progress') ||
      url.includes('/auth/') || !url.startsWith(self.location.origin)) return

  // Immutable Next.js build chunks — cache-first.
  if (url.includes('/_next/static/')) {
    e.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
          return res
        })
      )
    )
    return
  }

  // Page navigations — always hit the network so server-side auth/redirects run.
  // Never serve a cached HTML page (would show stale signed-in content to a
  // signed-out user). Only fall back to /offline when the network is unreachable.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(async () =>
        (await caches.match('/offline')) ||
        new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      )
    )
    return
  }

  // Other same-origin static GETs (images, fonts, etc.) — network, fall back to cache.
  e.respondWith(
    fetch(request).catch(async () =>
      (await caches.match(request)) ||
      new Response('', { status: 504 })
    )
  )
})

// Push notifications (from server-sent push events, if ever wired)
self.addEventListener('push', (e) => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'MediaDL', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'MediaDL', {
      body: data.body ?? '',
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: data.tag ?? 'mediadl',
      data: { url: data.url ?? '/' },
    })
  )
})

// Notification click — focus/open the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(target) }
      else self.clients.openWindow(target)
    })
  )
})
