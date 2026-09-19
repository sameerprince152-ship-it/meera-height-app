// service-worker.js - Caching for offline capability
const CACHE_NAME = 'meera-heights-cache-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './css/styles.css',
  './js/storage.js?v=4.4.0',
  './js/excel-export.js?v=4.4.0',
  './js/app.js?v=4.4.0',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network first with dynamic cache refresh, fallback to cache for offline
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
