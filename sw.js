const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE   = `essco-cache-${VERSION}`;

const ASSETS = [
  './',
  './manifest.json',
  './icon.svg'
];


// Install: precache minimal assets + take control ASAP
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate: clean old caches + claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML (navigations): NETWORK FIRST (fresh app), fallback to cache offline
// - Everything else: CACHE FIRST (fast), fallback to network
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const accept = req.headers.get('accept') || '';

  // Navigations / HTML documents
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          // offline fallback: whatever we have
          return (await caches.match(req)) || (await caches.match('./'));
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, resClone));
        return res;
      });
    })
  );
});
