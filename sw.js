/* sw.js — versioned via ?v=... in register() */
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE   = `essco-cache-${VERSION}`;

// Core files to cache for offline fallback
const CORE = [
  './',             // index.html
  './styles.css',
  './manifest.json',
  './icon.svg'
];

// ---- Install: precache core + activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      // Take control without waiting for a close/reopen
      await self.skipWaiting();
    })()
  );
});

// ---- Activate: clear old caches + control all pages now
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ---- Fetch: network-first for navigations + JS/CSS; cache-first for other static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET requests
  if (req.method !== 'GET') return;

  // 1) Navigations (HTML)
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 2) Always try network first for JS/CSS so code updates show up immediately
  if (isSameOrigin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) Everything else: cache-first (images, icons, etc.)
  event.respondWith(cacheFirst(req));
});

// -------- Strategies
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req) || await caches.match(req);
    // Fallback to index for SPA navigations if needed
    return cached || (req.mode === 'navigate' ? caches.match('./') : undefined);
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    // Don’t cache cross-origin opaque responses excessively
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return cached; // whatever we had
  }
}
