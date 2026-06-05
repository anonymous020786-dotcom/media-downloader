// Firebase Cloud Messaging service worker
// This file must be at the root path /firebase-messaging-sw.js
// It is loaded by the Firebase SDK automatically.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Config is injected at runtime via the main sw.js message channel.
// We store it in IndexedDB when the main thread calls initFCMInSW().
// Fallback: read from self.__FIREBASE_CONFIG if pre-configured.

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    const cfg = event.data.config
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg)
      const messaging = firebase.messaging()

      messaging.onBackgroundMessage((payload) => {
        const n = payload.notification ?? {}
        const d = payload.data ?? {}
        self.registration.showNotification(n.title ?? 'MediaDL', {
          body:  n.body ?? '',
          icon:  n.image ?? '/logo.svg',
          badge: '/logo.svg',
          tag:   d.tag ?? 'mediadl-fcm',
          data:  { url: d.url ?? '/', ...d },
          actions: [
            { action: 'open',    title: 'Open'    },
            { action: 'dismiss', title: 'Dismiss' },
          ],
          vibrate: [200, 100, 200],
        })
      })
    }
  }
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})
