const CACHE = 'pulse-v1'
const OFFLINE_URL = '/offline'

// Install: cache offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first, fall back to offline page for navigation
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r || new Response('Çevrimdışı', { status: 503 }))
    )
  )
})
