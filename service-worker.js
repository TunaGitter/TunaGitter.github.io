// Dragon Radar service worker
// Cache-first strategy: once installed, the app shell loads instantly with
// zero network, anywhere — no cell service, no wifi, nothing. Any same-origin
// GET response is opportunistically cached too, so this stays current
// whenever you do have signal, without you needing to do anything.

const CACHE_NAME = 'dragon-radar-v5'; // bumped: collapsible contact list, updated STALE_MS/EXPIRE_MS
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline and this exact request wasn't cached — fall back silently

      // cache-first: serve instantly if we have it, refresh cache in background;
      // otherwise wait on the network attempt above
      return cached || network;
    })
  );
});
