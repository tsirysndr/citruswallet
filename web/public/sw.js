/* Offline support is deliberately limited to public, static fallback assets.
 * Never cache API responses, OAuth, navigations, payment data, or avatar images.
 * Updates wait for existing windows to close; never reload an active payment. */
const CACHE = 'citrus-offline-v2';
const PUBLIC_ASSETS = ['/offline.html', '/offline.css', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/fonts/roboto-mono-latin.woff2'];
const SCREENS = new Set(['/', '/wallet', '/payments', '/activity', '/privacy', '/terms']);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS.map(path => new Request(path, { cache: 'reload', credentials: 'omit' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('citrus-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  if (event.request.mode === 'navigate' && SCREENS.has(url.pathname)) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('/offline.html')) ?? Response.error();
    }));
  } else if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) ?? fetch(event.request)));
  }
});
