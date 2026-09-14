// ══════════════════════════════════════════════════════════════
//  Filomer — sw.js (Service Worker)
//  Enables 100% offline app loading & PWA standalone functionality
// ══════════════════════════════════════════════════════════════

const APP_SHELL_CACHE = 'filomer-app-shell-v1'
const ASSET_CACHE = 'filomer-static-assets-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

// ─── Install: Precache App Shell ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => self.skipWaiting())
  )
})

// ─── Activate: Clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== APP_SHELL_CACHE && key !== ASSET_CACHE && !key.startsWith('filomer-engine-cache')) {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// ─── Fetch Strategy ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Engine cache is handled directly in ffmpegLoader.js via CacheStorage API
  if (url.pathname.endsWith('.wasm') || url.pathname.includes('@ffmpeg')) {
    return
  }

  // 1. Navigation requests (HTML) — Network first, fallback to cached /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(APP_SHELL_CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(APP_SHELL_CACHE)
          return (await cache.match(request)) || (await cache.match('/index.html'))
        })
    )
    return
  }

  // 2. Static Vite assets, Google Fonts, icons — Cache first, then network & update cache
  const isStaticAsset =
    url.origin === self.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached

        return fetch(request).then(response => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(ASSET_CACHE).then(cache => cache.put(request, clone))
          }
          return response
        }).catch(() => {
          // If offline and not in cache, let it fail gracefully
          return null
        })
      })
    )
  }
})
