// ── PROP DEV DNA SERVICE WORKER ──────────────────────────────────
// Version: 1.0.0
// Handles: offline caching, install prompt, background sync

const STATIC_CACHE = 'propdevdna-static-v2';
const API_CACHE = 'propdevdna-api-v2';   // no longer used: API responses are never cached (they can contain personal data)

// Assets to cache on install — critical for offline shell
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json',
  // Fonts loaded from Google — cached on first fetch
];

// ── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[PDD SW] Installing v1');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[PDD SW] Activating');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH STRATEGY ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests — always the network, never cached (responses can contain personal data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'You appear to be offline.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Unsplash images — cache first (they don't change)
  if (url.hostname.includes('unsplash.com')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Google Fonts — cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // App shell — network first so a new release shows immediately; cached copy only when offline
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Static assets (JS, CSS, images) — cache first
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else — network first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ── CACHE STRATEGIES ─────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — content not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineCache = await caches.match('/');
      if (offlineCache) return offlineCache;
    }
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkPromise;
}

// ── PUSH NOTIFICATIONS (future) ───────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Prop Dev DNA', {
      body: data.body || 'New opportunity available',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: data.tag || 'pdd-notification',
      data: { url: data.url || '/' },
      actions: [
        { action: 'view', title: 'View Opportunity' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

// ── BACKGROUND SYNC (EOI submissions) ────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-eoi') {
    event.waitUntil(syncPendingEOIs());
  }
});

async function syncPendingEOIs() {
  // Retry any failed EOI submissions when connection returns
  const cache = await caches.open('pdd-pending');
  const keys = await cache.keys();
  for (const key of keys) {
    if (key.url.includes('pending-eoi')) {
      try {
        const cached = await cache.match(key);
        const data = await cached.json();
        const response = await fetch('/api/eoi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (response.ok) await cache.delete(key);
      } catch (e) {
        console.log('[PDD SW] Sync retry failed — will retry later');
      }
    }
  }
}
