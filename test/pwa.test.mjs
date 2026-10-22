import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function worker() {
  const handlers = {};
  const saved = new Map();
  const requests = [];
  const cache = {
    addAll: async reqs => { for (const req of reqs) saved.set(req.url, new Response('offline document')); },
    match: async key => saved.get(typeof key === 'string' ? 'https://citruswallet.app' + key : key.url),
  };
  runInNewContext(readFileSync('web/public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://citruswallet.app' }, addEventListener: (name, fn) => handlers[name] = fn, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    Request: class extends Request { constructor(path, options) { super(new URL(path, 'https://citruswallet.app'), options); } },
    Response, URL, Set,
    fetch: async request => { requests.push(request.url); throw new Error('offline'); },
  });
  return { handlers, saved, requests };
}

test('PWA caches only static fallback assets and never intercepts payment or OAuth requests', async () => {
  const w = worker();
  let installed;
  w.handlers.install({ waitUntil: promise => installed = promise });
  await installed;
  assert.equal(w.saved.size, 6);
  for (const url of w.saved.keys()) assert.ok(!/xrpc|auth|activity|payments/.test(url));
  for (const [path, method, mode] of [
    ['/xrpc/app.citruswallet.getSession','GET','cors'],
    ['/xrpc/app.citruswallet.createPayment','POST','cors'],
    ['/auth/callback?code=secret','GET','navigate'],
    ['/client-metadata.json','GET','cors'],
    ['/?code=secret','GET','navigate'],
    ['https://cdn.bsky.app/avatar','GET','cors'],
  ]) {
    let intercepted = false;
    w.handlers.fetch({ request: { url: new URL(path, 'https://citruswallet.app').href, method, mode }, respondWith: () => intercepted = true });
    assert.equal(intercepted, false, path);
  }
  let fallback;
  w.handlers.fetch({ request: { url: 'https://citruswallet.app/activity', method: 'GET', mode: 'navigate' }, respondWith: promise => fallback = promise });
  assert.equal(await (await fallback).text(), 'offline document');
  assert.equal(w.saved.size, 6, 'no user navigation was stored');
});

test('install manifest icons exist at their declared dimensions', () => {
  const manifest = JSON.parse(readFileSync('web/public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) {
    const png = readFileSync('web/public' + icon.src);
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
