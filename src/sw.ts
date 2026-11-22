/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  const fallback = { title: 'BookTrack', body: 'The book changed.', tag: 'booktrack' }
  let payload = fallback
  try {
    const parsed = event.data?.json() as { title?: string; body?: string; tag?: string } | undefined
    if (parsed) payload = { ...fallback, ...parsed }
  } catch {
    const text = event.data?.text()
    if (text) payload = { ...fallback, body: text }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: 'pwa-192x192.png',
      badge: 'pwa-192x192.png',
      data: { url: './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const target = new URL('./', self.registration.scope).href
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => 'focus' in client)
      if (open) return open.focus()
      return self.clients.openWindow(target)
    })(),
  )
})
