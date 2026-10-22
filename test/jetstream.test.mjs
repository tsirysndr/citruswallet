import { ensure_profile } from '../build/dev/javascript/citruswallet/citruswallet/jetstream.mjs';
import { Ok, toList } from '../build/dev/javascript/citruswallet/gleam.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { applyAddressEvent, recordKey } from '../src/address-index.mjs';
import { queueRemovedAddress } from '../src/address-records.mjs';
import { startJetstream, configuredUrls, JETSTREAM_URLS, subscriptionUrl } from '../src/jetstream.mjs';
import * as storeModule from '../build/dev/javascript/citruswallet/citruswallet/store.mjs';
import * as profiles from '../build/dev/javascript/citruswallet/citruswallet/profiles.mjs';
import { Actor, Directory } from '../build/dev/javascript/citruswallet/citruswallet/directory.mjs';
import { None, Some } from '../build/dev/javascript/gleam_stdlib/gleam/option.mjs';

const did = 'did:plc:alice';
const origin = 'https://citruswallet.app';
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const other = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const rev = n => '3aaaaaaaaaaa' + n;
const row = db => db.prepare('SELECT * FROM links').all();
function database(t) {
  const store = storeModule.open(':memory:', './drizzle')[0];
  t.after(() => storeModule.close(store));
  return store.client;
}
async function record(wallet = account, owner = did) {
  const createdAt = '2026-01-01T00:00:00.000Z';
  const message = createSiweMessage({
    domain: 'citruswallet.app', address: wallet.address, chainId: 1,
    uri: origin + '/wallet-link', version: '1', nonce: '12345678',
    issuedAt: new Date(createdAt), expirationTime: new Date('2026-01-01T00:05:00.000Z'),
    statement: `Link this wallet to AT Protocol account ${owner}. This does not authorize transactions.`, resources: [owner],
  });
  return { $type: 'app.citruswallet.address', chain: 'eip155:1', address: wallet.address.toLowerCase(), message, signature: await wallet.signMessage({ message }), createdAt };
}
const event = (operation, number, value, rkey = 'receiving') => ({ did, kind: 'commit', commit: { operation, rev: rev(number), collection: 'app.citruswallet.address', rkey, record: value } });

test('Jetstream create, update, delete and durable deduplication preserve the latest repository revision', async t => {
  const db = database(t);
  const first = await record();
  const second = await record(other);
  assert.equal(await applyAddressEvent(db, event('create', 2, first), origin), 'applied');
  assert.equal(row(db)[0].address, first.address);
  assert.equal(row(db)[0].is_default, 1);
  assert.equal(await applyAddressEvent(db, event('update', 3, second), origin), 'applied');
  assert.equal(row(db).length, 1);
  assert.equal(row(db)[0].address, second.address);
  assert.equal(await applyAddressEvent(db, event('create', 2, first), origin), 'duplicate');
  assert.equal(await applyAddressEvent(db, event('delete', 4), origin), 'deleted');
  assert.equal(row(db).length, 0);
  assert.equal(await applyAddressEvent(db, event('update', 3, second), origin), 'duplicate');
  assert.equal(db.prepare('SELECT rev,record FROM address_repository_records').get().record, null);
});

test('foreign DID proofs and invalid record updates never become receiving addresses', async t => {
  const db = database(t);
  assert.equal(await applyAddressEvent(db, event('create', 2, await record(account, 'did:plc:bob')), origin), 'invalid');
  assert.equal(row(db).length, 0);
  const valid = await record();
  await applyAddressEvent(db, event('update', 3, valid), origin);
  const bad = { ...valid, address: other.address.toLowerCase() };
  assert.equal(await applyAddressEvent(db, event('update', 4, bad), origin), 'invalid');
  assert.equal(row(db).length, 0);
});

test('multiple records for one address, local private links, and pending local deletions are respected', async t => {
  const db = database(t);
  const value = await record();
  await applyAddressEvent(db, event('create', 2, value, 'first'), origin);
  await applyAddressEvent(db, event('create', 3, value, 'second'), origin);
  await applyAddressEvent(db, event('delete', 4, undefined, 'first'), origin);
  assert.equal(row(db).length, 1);
  db.prepare('UPDATE links SET public=0,is_default=0').run();
  await applyAddressEvent(db, event('update', 5, value, 'second'), origin);
  assert.equal(row(db)[0].public, 0);
  await applyAddressEvent(db, event('delete', 6, undefined, 'second'), origin);
  assert.equal(row(db)[0].public, 0);
  db.prepare('DELETE FROM links').run();
  queueRemovedAddress(db, did, 1, value.address);
  await applyAddressEvent(db, event('create', 7, value, recordKey(1, value.address)), origin);
  assert.equal(row(db).length, 0);
});

test('profile failure leaves both event and cursor uncommitted for replay', async t => {
  const db = database(t);
  let checkpoints = 0;
  const e = event('create', 2, await record());
  await assert.rejects(applyAddressEvent(db, e, origin, () => checkpoints++, async () => false));
  assert.equal(checkpoints, 0);
  assert.equal(row(db).length, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM address_repository_records').get().n, 0);
  await applyAddressEvent(db, e, origin, () => checkpoints++, async () => true);
  assert.equal(checkpoints, 1);
});

class FakeSocket extends EventTarget {
  static instances = [];
  constructor(url, protocols) { super(); this.url = new URL(url); this.protocols = protocols; FakeSocket.instances.push(this); }
  close() { this.dispatchEvent(new Event('close')); }
  receive(payload) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) })); }
}
const envelope = (e, seq) => ({ $type: 'message', payload: { ...e.commit, did: e.did, seq, $type: 'network.bsky.jetstream.subscribeEvents#commit' } });

test('parallel production connections deduplicate, checkpoint separately, and resume after restart', async t => {
  const db = database(t);
  FakeSocket.instances = [];
  let profileLookups = 0;
  const options = { WebSocket: FakeSocket, env: { JETSTREAM_URLS: 'wss://east.test,wss://west.test' }, log: () => {} };
  const worker = startJetstream(db, origin, async () => { profileLookups++; return true; }, options);
  assert.equal(FakeSocket.instances.length, 2);
  const sockets = [...FakeSocket.instances];
  const e = event('create', 2, await record());
  sockets[0].receive(envelope(e, 100));
  sockets[1].receive(envelope(e, 900));
  await worker.stop();
  assert.equal(profileLookups, 1);
  assert.equal(row(db).length, 1);
  const cursors = db.prepare("SELECT value FROM kv WHERE namespace='jetstream-cursor' ORDER BY key").all().map(x => JSON.parse(x.value));
  assert.deepEqual(cursors, [100, 900]);
  const restarted = startJetstream(db, origin, async () => true, options);
  assert.deepEqual(FakeSocket.instances.slice(2).map(x => x.url.searchParams.get('cursor')), ['100', '900']);
  await restarted.stop();
});

test('JETSTREAM_URLS overrides constants, normalizes endpoints, and rejects invalid configuration', () => {
  assert.equal(JETSTREAM_URLS.length, 4);
  assert.deepEqual(configuredUrls({ JETSTREAM_URLS: 'wss://example.com/subscribe, wss://example.com/subscribe' }), ['wss://example.com/subscribe']);
  assert.equal(configuredUrls({ JETSTREAM_URLS: 'wss://example.com' })[0], 'wss://example.com/xrpc/network.bsky.jetstream.subscribeEvents');
  assert.throws(() => configuredUrls({ JETSTREAM_URLS: '' }));
  assert.throws(() => configuredUrls({ JETSTREAM_URLS: 'ws://example.com/subscribe' }));
  const url = subscriptionUrl('wss://example.com/subscribe', 10_000_000);
  assert.equal(url.searchParams.get('wantedCollections'), 'app.citruswallet.address');
  assert.equal(url.searchParams.get('cursor'), '5000000');
});

test('profile id migration preserves existing rows and DID upserts retain the same id', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync('drizzle/0001_robust_nico_minoru.sql', 'utf8'));
  db.prepare('INSERT INTO user_profiles(did,handle,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').run(did, 'alice.test', 'Alice', 123, 456);
  db.exec(readFileSync('drizzle/0003_chief_adam_destine.sql', 'utf8'));
  const migrated = db.prepare('SELECT * FROM user_profiles').get();
  assert.equal(migrated.id, 1);
  assert.equal(migrated.did, did);
  assert.equal(migrated.created_at, 123);
  const store = storeModule.open(':memory:', './drizzle')[0];
  t.after(() => storeModule.close(store));
  profiles.save(store, new Actor(did, 'alice.test', new None(), new None()), 100);
  const id = store.client.prepare('SELECT id FROM user_profiles').get().id;
  profiles.save(store, new Actor(did, 'new.test', new None(), new None()), 200);
  assert.deepEqual(store.client.prepare('SELECT id,handle,created_at,updated_at FROM user_profiles').get(), { id, handle: 'new.test', created_at: 100, updated_at: 200 });
});


test('unknown event DIDs fetch and upsert the full stored profile once', async t => {
  const store = storeModule.open(':memory:', './drizzle')[0];
  t.after(() => storeModule.close(store));
  let lookups = 0;
  const directory = new Directory(async () => new Ok(toList([])), async value => {
    lookups++;
    return new Ok(new Some(new Actor(value, 'alice.test', new Some('Alice'), new Some('https://cdn.bsky.app/img/avatar/plain/example/avatar@jpeg'))));
  });
  const ensure = value => ensure_profile(store, directory, value);
  await applyAddressEvent(store.client, event('create', 2, await record()), origin, () => {}, ensure);
  const saved = store.client.prepare('SELECT * FROM user_profiles WHERE did=?').get(did);
  assert.equal(saved.handle, 'alice.test');
  assert.equal(saved.display_name, 'Alice');
  assert.match(saved.avatar, /^https:\/\/cdn.bsky.app/);
  assert.ok(saved.id > 0 && saved.created_at > 0 && saved.updated_at > 0);
  await applyAddressEvent(store.client, event('delete', 3), origin, () => {}, ensure);
  assert.equal(lookups, 1);
});
