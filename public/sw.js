const CACHE_NAME = 'postrack-cache-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/postracker-192.png',
  '/icons/postracker-512.png',
  '/icons/postracker-512-maskable.png',
  '/icons/postracker-192-maskable.png',
  '/icons/postracker-1024.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png'
];

// Install Event - Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching authoritative POSTRACKER assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clear obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network-First for APIs/pages, Cache-First for static icons/manifest)
self.addEventListener('fetch', (event) => {
  // Ignore external API endpoints, Firestore, and Dev server websockets
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('identitytoolkit.googleapis.com') ||
    event.request.url.includes('securetoken.googleapis.com') ||
    event.request.url.includes('ws') ||
    event.request.url.includes('vite') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // For static icons and manifest: Serve cached if available, fallback to network
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.json') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background (stale-while-revalidate for assets)
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Navigation & generic GET requests
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 && 
          event.request.url.startsWith(self.location.origin)
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
      })
  );
});
