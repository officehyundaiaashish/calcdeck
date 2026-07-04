/*
 * CalcDeck — Service Worker
 *
 * Strategy:
 *   • Navigation (HTML)  → Network-first  → instant updates on every deploy
 *   • Static assets      → Stale-while-revalidate → fast loads + background refresh
 *   • Offline fallback   → cached index.html
 *
 * No version/cache renaming needed.
 * The SW file itself is the update signal — GitHub Pages serves the new sw.js
 * and the browser detects the byte change, installs, and activates immediately.
 */

const CACHE = 'calcdeck-shell';

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  // Activate immediately — no waiting for old tabs to close
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './icon.png'
      ]).catch(() => {
        // Non-fatal: some assets may not exist yet
      })
    )
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  // Take control of all open tabs immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Remove any stale caches from previous SW versions (if names differ)
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
    ])
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle same-origin GET requests
  if (req.method !== 'GET') return;
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
  } catch (_) { return; }

  /*
   * NETWORK FIRST WITH OFFLINE FALLBACK
   * Always fetch from the network first when online to guarantee that
   * every update/commit is served instantly. Fall back to cache only when offline.
   */
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(req).then(cached => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
