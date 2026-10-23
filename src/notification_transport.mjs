import { streamSSE } from 'hono/streaming';
import webpush from 'web-push';
import { ECDH } from 'node:crypto';
export const generateKeys = () => webpush.generateVAPIDKeys();
export const validPublicKey = key => { try { const bytes = Buffer.from(key, 'base64url'); return bytes.length === 65 && bytes[0] === 4 && !!ECDH.convertKey(bytes, 'prime256v1'); } catch { return false; } };
export const sendWeb = (subscription, payload, options) => webpush.sendNotification(subscription, payload, options);
export async function invoke(callback, args) {
  try { return { ok: true, value: await callback(...args) }; }
  catch (error) { return { ok: false, status: error.statusCode || 0, message: String(error.message || 'Transport failure') }; }
}
// Transport lifecycle only. Authentication, cursor progression and event data
// are supplied by the Gleam callback on every poll.
const connections = new Map();
export function stream(context, key, maxConnections, poll) {
  if ((connections.get(key) || 0) >= maxConnections) return context.json({ error: 'RateLimitExceeded', message: 'Too many notification streams.' }, 429);
  connections.set(key, (connections.get(key) || 0) + 1);
  context.header('X-Accel-Buffering', 'no');
  return streamSSE(context, async output => {
    let aborted = false, tick = 0;
    output.onAbort(() => { aborted = true; });
    try {
      await output.writeSSE({ event: 'ready', data: '{}', retry: 3000 });
      while (!aborted) {
        const batch = poll();
        if (batch.expired) { await output.writeSSE({ event: 'session-expired', data: '{}' }); break; }
        for (const event of batch.events) await output.writeSSE(event);
        if (++tick % 8 === 0) await output.write(': heartbeat\n\n');
        await output.sleep(2000);
      }
    } finally {
      const count = (connections.get(key) || 1) - 1;
      if (count) connections.set(key, count); else connections.delete(key);
    }
  });
}
export function every(milliseconds, callback) {
  let running = false, stopped = false;
  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try { await callback(() => stopped); }
    catch (error) { console.error('Notification worker failed:', error.name); }
    finally { running = false; }
  }, milliseconds);
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
