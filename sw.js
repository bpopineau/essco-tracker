// sw.js
/* sw.js — versioned via ?v=... in register() */
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE   = `essco-cache-${VERSION}`;
const ORIGIN  = self.location.origin;
const INDEX   = new URL('./', self.location).href; // SPA fallback target

// Core files to cache for offline fallback
const CORE = [
  './',
  './styles.css',
  './manifest.json',
  './icon-wrapper.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// ---- Install: precache core + activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
    } finally {
      // Take control without waiting for a close/reopen
      await self.skipWaiting();
    }
  })());
});

// ---- Activate: clear old caches + control all pages now + enable nav preload
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean old versions
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));

    // Speed up navigations by letting the browser start the fetch early
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }

    await self.clients.claim();
  })());
});

// ---- Message: allow client to trigger skipWaiting (toast "Refresh")
self.addEventListener('message', (event) => {
  if (event?.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- Fetch: network-first for navigations + JS/CSS; cache-first for other static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET requests
  if (req.method !== 'GET') return;

  // 1) Navigations (HTML)
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  const url = new URL(req.url);
  const isSameOrigin = url.origin === ORIGIN;

  // 2) Always try network first for JS/CSS so code updates show up immediately
  if (isSameOrigin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(networkFirstAsset(req));
    return;
  }

  // 3) Everything else: cache-first (images, icons, etc.)
  event.respondWith(cacheFirst(req));
});

// -------- Strategies
async function networkFirstNavigation(event) {
  const cache = await caches.open(CACHE);

  // Try navigation preload if available
  try {
    const pre = await event.preloadResponse;
    if (pre) {
      cache.put(event.request, pre.clone());
      return pre;
    }
  } catch {}

  // Try the network (fresh)
  try {
    const fresh = await fetch(event.request, { cache: 'no-store' });
    cache.put(event.request, fresh.clone());
    return fresh;
  } catch {
    // Fallback to cached navigation, then to the app shell (INDEX)
    const cached = await cache.match(event.request) || await caches.match(event.request);
    if (cached) return cached;
    const shell = await caches.match(INDEX);
    if (shell) return shell;
    // Final fallback: a minimal Response (avoids opaque undefined)
    return new Response('<h1>Offline</h1><p>Content is unavailable.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503
    });
  }
}

async function networkFirstAsset(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req) || await caches.match(req);
    return cached || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    // Only cache same-origin successful responses
    if (fresh && fresh.ok && new URL(req.url).origin === ORIGIN) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    return cached || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}
