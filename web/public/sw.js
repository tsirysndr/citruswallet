/* Offline support is deliberately limited to public, static fallback assets.
 * Never cache API responses, OAuth, navigations, payment data, or avatar images.
 * Updates wait for existing windows to close; never reload an active payment. */
const CACHE = 'citrus-offline-v2';
const PUBLIC_ASSETS = ['/offline.html', '/offline.css', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/fonts/roboto-mono-latin.woff2'];
const SCREENS = new Set(['/', '/wallet', '/payments', '/activity', '/privacy', '/terms']);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS.map(path => new Request(path, { cache: 'reload', credentials: 'omit' })))));
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const valid = typeof data.paymentId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(data.paymentId);
  event.waitUntil(self.registration.showNotification('Payment received', {
    body: 'Open Citrus Wallet to view your payment.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: valid ? 'payment-' + data.paymentId : 'citrus-payment',
    data: valid ? { paymentId: data.paymentId, notificationId: String(data.notificationId || ''), chainId: [1, 4326].includes(data.chainId) ? data.chainId : 1 } : {},
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { paymentId, notificationId, chainId } = event.notification.data || {};
  const valid = typeof paymentId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(paymentId);
  const path = valid ? '/payments?notificationPayment=' + encodeURIComponent(paymentId) + '&notificationId=' + encodeURIComponent(notificationId || '') + '&chainId=' + ([1, 4326].includes(chainId) ? chainId : 1) : '/activity';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url === new URL(path, self.location.origin).href);
    if (existing) await existing.focus();
    else await self.clients.openWindow(path);
  })());
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
