// === FILE: Chadmaxxing/sw.js ===
// Service worker: caches local assets only. CDN (MediaPipe) passes through.

const CACHE_NAME = 'chadmaxxing-v1';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/camera.js',
  './js/landmarks.js',
  './js/mediapipe-loader.js',
  './js/metrics.js',
  './js/scoring.js',
  './js/recommendations.js',
  './js/storage.js',
  './js/ui.js',
  './js/utils.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Install: precache local assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(LOCAL_ASSETS).catch((err) => {
        console.warn('SW: some assets failed to cache during install:', err);
        // Don't fail install if icons are missing
        return cache.addAll(LOCAL_ASSETS.filter(a => !a.includes('icons/')));
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for local assets, network-only for CDN
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin (local) requests with cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          // Cache successful GET responses for local assets
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => {
        // If offline and not cached, return the index for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
    );
  }
  // CDN requests (MediaPipe) pass through to network — no caching
});
