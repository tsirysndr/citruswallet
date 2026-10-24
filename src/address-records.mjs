import { saveRecordHead, recordKey, needsPublication } from './address-index.mjs';
export { needsPublication };
import { randomUUID } from 'node:crypto';
import { lexicons } from './xrpc.mjs';

const collection = 'app.peachlet.address';
const namespace = did => `address-record:${did}`;

// Called inside the same SQLite transaction as the verified link mutation.
// Retain tombstones until the PDS acknowledges them, including across restarts.
export function queueAddress(db, did, chain, address, record) {
  const value = JSON.stringify({ version: randomUUID(), record });
  db.prepare(`INSERT INTO kv(namespace,key,value,expires) VALUES(?,?,?,?)
    ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,expires=excluded.expires`)
    .run(namespace(did), recordKey(chain, address), value, Number.MAX_SAFE_INTEGER);
}

export function queueVerifiedAddress(db, did, chain, address, isPublic, message, signature, createdAt) {
  const record = isPublic ? {
    $type: collection, chain: `eip155:${chain}`, address: address.toLowerCase(),
    message, signature, createdAt,
  } : null;
  if (record) lexicons.assertValidRecord(collection, record);
  queueAddress(db, did, chain, address, record);
}

export const queueRemovedAddress = (db, did, chain, address) => queueAddress(db, did, chain, address, null);
export const addressSyncPending = (db, did) => Boolean(db.prepare('SELECT 1 FROM kv WHERE namespace=? LIMIT 1').get(namespace(did)));

const running = new Map();
export async function syncAddresses(db, client, did, acceptMessage) {
  // A single writer per DID prevents old puts overtaking newer deletes.
  const prior = running.get(did) ?? Promise.resolve();
  const task = prior.then(() => flush(db, client, did, acceptMessage));
  running.set(did, task);
  try { return await task; }
  finally { if (running.get(did) === task) running.delete(did); }
}

async function flush(db, client, did, acceptMessage) {
  if (!addressSyncPending(db, did)) return true;
  try {
    const session = await client.restore(did);
    const { scope } = await session.getTokenInfo();
    if (!scope.split(' ').includes(`repo:${collection}`)) return false;
    // Bounded work per request. Pending work is retried after login or via
    // syncAddresses; failures never report an unpublished record as published.
    for (let count = 0; count < 50; count++) {
      const item = db.prepare('SELECT key,value FROM kv WHERE namespace=? ORDER BY key LIMIT 1').get(namespace(did));
      if (!item) return true;
      const { record } = JSON.parse(item.value);
      // Gleam validates the signed origin. Never rewrite a signed proof to migrate it.
      if (record && (record.$type !== collection || !acceptMessage?.(record.message))) {
        db.prepare('DELETE FROM kv WHERE namespace=? AND key=? AND value=?').run(namespace(did), item.key, item.value);
        continue;
      }
      if (record) lexicons.assertValidRecord(collection, record);
      const method = record ? 'putRecord' : 'deleteRecord';
      const body = { repo: did, collection, rkey: item.key };
      if (record) Object.assign(body, { record, validate: false });
      const response = await session.fetchHandler(`/xrpc/com.atproto.repo.${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok && !(record === null && result.error === 'RecordNotFound')) return false;
      // An edit during the network request must remain queued for another pass.
      db.transaction(() => {
        saveRecordHead(db, did, item.key, result.commit?.rev, record);
        db.prepare('DELETE FROM kv WHERE namespace=? AND key=? AND value=?')
          .run(namespace(did), item.key, item.value);
      })();
    }
    return !addressSyncPending(db, did);
  } catch {
    return false;
  }
}
