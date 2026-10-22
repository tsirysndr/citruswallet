import { applyAddressEvent, ADDRESS_COLLECTION } from './address-index.mjs';

// Official production instances; JETSTREAM_URLS replaces this entire list.
export const JETSTREAM_URLS = Object.freeze([
  'wss://jetstream1.us-east.bsky.network/subscribe',
  'wss://jetstream2.us-east.bsky.network/subscribe',
  'wss://jetstream1.us-west.bsky.network/subscribe',
  'wss://jetstream2.us-west.bsky.network/subscribe',
]);
export function configuredUrls(env = process.env) {
  const urls = env.JETSTREAM_URLS === undefined ? [...JETSTREAM_URLS] : env.JETSTREAM_URLS.split(',').map(s => s.trim()).filter(Boolean);
  if (!urls.length) throw new Error('JETSTREAM_URLS must contain at least one WebSocket URL.');
  return [...new Set(urls.map(value => {
    const url = new URL(value);
    if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('JETSTREAM_URLS must use WSS (or loopback WS).');
    if (url.username || url.password || url.hash) throw new Error('Invalid Jetstream URL.');
    if (url.pathname === '/') url.pathname = '/xrpc/network.bsky.jetstream.subscribeEvents';
    return url.href;
  }))];
}

export function normalizeEvent(frame) {
  if (frame?.$type === 'message' && frame.payload) {
    const p = frame.payload;
    return { did: p.did, kind: p.$type?.endsWith('#commit') ? 'commit' : 'other', commit: p, cursor: p.cursor ?? p.seq };
  }
  return { ...frame, cursor: frame?.time_us };
}

export function subscriptionUrl(endpoint, cursor) {
  const url = new URL(endpoint);
  const legacy = url.pathname === '/subscribe';
  url.searchParams.set(legacy ? 'wantedCollections' : 'collections', ADDRESS_COLLECTION);
  if (!legacy) url.searchParams.set('kinds', 'commit');
  if (cursor !== undefined && cursor !== null) {
    url.searchParams.set('cursor', String(legacy ? Math.max(0, Number(cursor) - 5_000_000) : cursor));
  }
  return url;
}

export function startJetstream(db, origin, ensureProfile = async () => true, options = {}) {
  const env = options.env ?? process.env;
  if (env.JETSTREAM_ENABLED === 'false') return { stop: async () => {} };
  const endpoints = configuredUrls(env);
  const Socket = options.WebSocket ?? globalThis.WebSocket;
  const log = options.log ?? console.log;
  let stopped = false;
  let work = Promise.resolve();
  let queued = 0;
  const connections = [];
  const getCursor = endpoint => {
    const row = db.prepare("SELECT value FROM kv WHERE namespace='jetstream-cursor' AND key=?").get(endpoint);
    return row ? JSON.parse(row.value) : undefined;
  };
  const checkpoint = (endpoint, cursor) => {
    if ((typeof cursor !== 'string' || !cursor.length || cursor.length > 2048) && !Number.isSafeInteger(cursor)) throw new Error('Invalid Jetstream cursor');
    db.prepare(`INSERT INTO kv(namespace,key,value,expires) VALUES('jetstream-cursor',?,?,?)
      ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value`).run(endpoint, JSON.stringify(cursor), Number.MAX_SAFE_INTEGER);
  };
  for (const endpoint of endpoints) {
    const state = { socket: null, timer: null, watchdog: null, retries: 0, lastIgnoredCheckpoint: 0 };
    connections.push(state);
    const connect = () => {
      if (stopped) return;
      const legacy = new URL(endpoint).pathname === '/subscribe';
      let socket;
      try { socket = new Socket(subscriptionUrl(endpoint, getCursor(endpoint)), legacy ? [] : ['xrpc.v1.json']); }
      catch { retry(); return; }
      state.socket = socket;
      let failed = false;
      const resetWatchdog = () => {
        clearTimeout(state.watchdog);
        // Reconnect quiet or half-open connections too; persisted cursors make
        // the replay safe even when this narrow collection has been idle.
        state.watchdog = setTimeout(() => socket.close(), 120_000);
        state.watchdog.unref?.();
      };
      resetWatchdog();
      socket.addEventListener('open', () => {
        state.retries = 0;
        log(`Jetstream connected: ${new URL(endpoint).host}`);
        resetWatchdog();
      });
      socket.addEventListener('message', ({ data }) => {
        resetWatchdog();
        if (stopped || failed) return;
        if (typeof data !== 'string' || data.length > 131072 || queued >= 1000) { failed = true; socket.close(); return; }
        let event;
        try { event = normalizeEvent(JSON.parse(data)); } catch { failed = true; socket.close(); return; }
        if (event.cursor === undefined) { failed = true; socket.close(); return; }
        queued++;
        work = work.then(async () => {
          if (failed) return;
          try {
            if (event.kind === 'commit') {
              await applyAddressEvent(db, event, origin, () => checkpoint(endpoint, event.cursor), ensureProfile);
            } else if (Date.now() - state.lastIgnoredCheckpoint >= 5000) {
              checkpoint(endpoint, event.cursor);
              state.lastIgnoredCheckpoint = Date.now();
            }
          } catch {
            // Never checkpoint past a failed database mutation. Closing causes
            // this endpoint to replay from the last committed cursor.
            failed = true;
            log(`Jetstream processing failed; replaying ${new URL(endpoint).host}`);
            socket.close();
          }
        }).finally(() => { queued--; });
      });
      socket.addEventListener('error', () => socket.close());
      socket.addEventListener('close', () => {
        clearTimeout(state.watchdog);
        // Drain accepted events before reading the persisted resume point.
        work.then(() => retry());
      });
    };
    const retry = () => {
      if (stopped) return;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(state.retries++, 5)) + Math.floor(Math.random() * 500);
      log(`Jetstream reconnecting: ${new URL(endpoint).host}`);
      state.timer = setTimeout(connect, delay);
      state.timer.unref?.();
    };
    connect();
  }
  return {
    async stop() {
      stopped = true;
      for (const state of connections) {
        clearTimeout(state.timer);
        clearTimeout(state.watchdog);
        state.socket?.close();
      }
      await work;
    },
  };
}

export const stopJetstream = listener => listener.stop();
