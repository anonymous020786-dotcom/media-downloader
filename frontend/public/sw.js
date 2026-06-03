const CACHE = 'mediadl-v1'
const STATIC = [
  '/',
  '/download',
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
//   API / SSE  → network-only (never cache)
//   _next/static → cache-first (immutable build assets)
//   everything else → network-first, fall back to cache, then /offline
self.addEventListener('fetch', (e) => {
  const { url, method } = e.request
  if (method !== 'GET') return

  // Never intercept API, SSE, or external URLs
  if (url.includes('/api/') || url.includes('/progress') || !url.startsWith(self.location.origin)) return

  // Immutable Next.js build chunks — cache-first
  if (url.includes('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit ?? fetch(e.request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
          return res
        })
      )
    )
    return
  }

  // Network-first for pages
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit ?? caches.match('/offline') ?? new Response('Offline', { status: 503 }))
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
