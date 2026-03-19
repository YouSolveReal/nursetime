// ============================================================
// SERVICE WORKER — NurseTime PWA
// Hosted at: https://yousolvereal.github.io/nursetime/
// Cache-first for static assets, network-first for Firebase.
// ============================================================

const CACHE_NAME  = 'nursetime-v2';
const BASE        = '/nursetime';

const STATIC_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/app.css`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/shift-utils.js`,
  `${BASE}/js/db.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/clock.js`,
  `${BASE}/js/calendar.js`,
  `${BASE}/js/pay.js`,
  `${BASE}/js/settings.js`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

// ── Install: pre-cache static assets ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Let Firebase / CDN requests go straight to network
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('firebase')
  ) {
    return; // default browser fetch
  }

  // Cache-first for local assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(`${BASE}/index.html`);
        }
      });
    })
  );
});
