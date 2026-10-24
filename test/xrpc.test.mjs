import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createECDH, randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { XrpcClient } from '@atproto/xrpc';
import { schemas } from '../src/generated/lexicons.mjs';
import { lexicons } from '../src/xrpc.mjs';
import { syncAddresses, queueRemovedAddress, queueVerifiedAddress, addressSyncPending } from '../src/address-records.mjs';
import { proof_matches_origin } from '../build/dev/javascript/peachlet/peachlet/linking.mjs';
import { build } from '../build/dev/javascript/peachlet/peachlet/app.mjs';
import { Chain } from '../build/dev/javascript/peachlet/peachlet/chain.mjs';
import { Settings } from '../build/dev/javascript/peachlet/peachlet/xrpc/context.mjs';
import * as storeModule from '../build/dev/javascript/peachlet/peachlet/store.mjs';
import * as oauthModule from '../build/dev/javascript/peachlet/peachlet/oauth.mjs';
import { mainnet, megaeth, megaeth_testnet } from '../build/dev/javascript/peachlet/peachlet/network.mjs';
import { Directory } from '../build/dev/javascript/peachlet/peachlet/directory.mjs';
import { Identity } from '../build/dev/javascript/peachlet/peachlet/identity.mjs';
import { None, Some } from '../build/dev/javascript/gleam_stdlib/gleam/option.mjs';
import { Ok, toList } from '../build/dev/javascript/peachlet/gleam.mjs';

const origin = 'https://peachlet.app';
const alice = 'did:plc:alice';
const bob = 'did:plc:bob';
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const env = { incoming: { socket: { remoteAddress: '127.0.0.1', remoteFamily: 'IPv4', remotePort: 10000 } } };

function fixture(t, chain = new None(), network = mainnet) {
  const opened = storeModule.open(':memory:', './drizzle');
  assert.ok(opened instanceof Ok);
  const store = opened[0];
  t.after(() => storeModule.close(store));
  let failPds = false;
  const writes = [];
  const oauth = {
    clientMetadata: { scope: 'atproto repo:app.peachlet.address' },
    restore: async () => ({
      getTokenInfo: async () => ({ scope: 'atproto repo:app.peachlet.address' }),
      fetchHandler: async (path, options) => {
        writes.push({ path, body: JSON.parse(options.body) });
        return Response.json(failPds ? { error: 'Unavailable' } : { uri: 'at://record', cid: 'test' }, { status: failPds ? 503 : 200 });
      },
    }),
  };
  const directory = new Directory(async () => new Ok(toList([])), async () => new Ok(new None()));
  const lookup = async identifier => new Ok(new Identity(identifier?.[0] === 'alice.test' ? alice : bob, new Some('bob.test')));
  const app = build(new Settings(store, oauth, origin, 0, network, lookup, directory, 'https://bsky.social', chain, './web/dist'));
  let cookie = '';
  let csrf = '';
  async function raw(path, options = {}) {
    const response = await app.fetch(new Request(origin + path, {
      ...options,
      headers: { Host: 'peachlet.app', Origin: origin, cookie, 'x-csrf-token': csrf, ...Object.fromEntries(new Headers(options.headers)) },
    }), env);
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  const client = new XrpcClient(raw, schemas);
  const call = (name, body) => client.call('app.peachlet.' + name, undefined, body).then(r => r.data);
  const query = (name, params) => client.call('app.peachlet.' + name, params).then(r => r.data);
  async function login(did = alice) {
    csrf = (await query('getSession')).csrf;
    const token = cookie.split('=')[1];
    const key = createHash('sha256').update(token).digest('hex');
    const row = store.client.prepare("SELECT value FROM kv WHERE namespace='browser' AND key=?").get(key);
    store.client.prepare("UPDATE kv SET value=? WHERE namespace='browser' AND key=?").run(JSON.stringify({ ...JSON.parse(row.value), did }), key);
  }
  return { store, app, oauth, raw, call, query, login, writes, fail: value => { failPds = value; } };
}

test('XRPC session, OAuth metadata, errors, CSRF, body schemas and removed REST routes', async t => {
  const f = fixture(t);
  for (const schema of schemas) {
    const kind = schema.defs.main?.type;
    if (!['query', 'procedure'].includes(kind)) continue;
    assert.ok(f.app.routes.some(route => route.path === '/xrpc/' + schema.id && route.method === (kind === 'query' ? 'GET' : 'POST')), schema.id);
  }
  const session = await f.query('getSession');
  assert.equal(session.network.chainId, 1);
  assert.equal(session.did, null);
  assert.equal(session.addressSyncPending, false);
  const realOauth = oauthModule.client(f.store, origin);
  assert.equal(realOauth.clientMetadata.scope, 'atproto repo:app.peachlet.address');
  assert.deepEqual(realOauth.clientMetadata.redirect_uris, [origin + '/auth/callback']);
  assert.equal((await f.raw('/api/session')).status, 404);
  await assert.rejects(f.query('getProfile'), e => e.status === 401);
  let response = await f.raw('/xrpc/app.peachlet.createChallenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
  await f.login();
  await assert.rejects(f.call('createChallenge', { address: 123 }), e => e.status === 400 && e.error === 'InvalidRequest');
  assert.equal((await f.raw('/xrpc/app.peachlet.getPayment?id=one&id=two')).status, 400);
  response = await f.raw('/xrpc/app.peachlet.getSession', { headers: { Host: 'evil.test' } });
  assert.equal(response.status, 400);
  assert.equal((await f.call('logout', {})).ok, true);
  assert.equal((await f.query('getSession')).did, null);
});

test('signed public links publish verified CAIP-2 records; private relinking deletes them', async t => {
  const f = fixture(t);
  await f.login();
  for (const isPublic of [true, false]) {
    const challenge = await f.call('createChallenge', { address: account.address, public: isPublic });
    const signature = await account.signMessage({ message: challenge.message });
    const linked = await f.call('verifyChallenge', { id: challenge.id, signature });
    assert.equal(linked.addressSyncPending, false);
    assert.equal(linked.links[0].public, isPublic);
    const write = f.writes.at(-1);
    assert.equal(write.body.repo, alice);
    assert.equal(write.body.collection, 'app.peachlet.address');
    assert.equal(write.body.rkey, `eip155-1-${account.address.toLowerCase()}`);
    if (isPublic) {
      assert.match(write.path, /putRecord$/);
      assert.equal(write.body.record.chain, 'eip155:1');
      assert.equal(write.body.record.address, account.address.toLowerCase());
      assert.equal(write.body.record.signature, signature);
      assert.ok(lexicons.validate('app.peachlet.address', write.body.record).success);
    } else assert.match(write.path, /deleteRecord$/);
    await assert.rejects(f.call('verifyChallenge', { id: challenge.id, signature }), e => e.status === 400);
  }
  assert.equal((await f.query('getAddresses', { did: alice })).links.length, 0);
  assert.equal((await f.call('unlinkAddress', { address: account.address })).links.length, 0);
});

test('failed publication and unlink keep a durable tombstone and retry without re-signing', async t => {
  const f = fixture(t);
  await f.login();
  f.fail(true);
  const challenge = await f.call('createChallenge', { address: account.address, public: true });
  const signature = await account.signMessage({ message: challenge.message });
  assert.equal((await f.call('verifyChallenge', { id: challenge.id, signature })).addressSyncPending, true);
  assert.equal((await f.call('unlinkAddress', { address: account.address })).addressSyncPending, true);
  assert.equal((await f.query('getSession')).links.length, 0);
  const row = f.store.client.prepare("SELECT value FROM kv WHERE namespace=?").get('address-record:' + alice);
  assert.equal(JSON.parse(row.value).record, null);
  f.fail(false);
  assert.equal((await f.call('syncAddresses', {})).addressSyncPending, false);
  assert.match(f.writes.at(-1).path, /deleteRecord$/);
});

test('invalid signatures cannot queue records; old OAuth scope cannot write', async t => {
  const f = fixture(t);
  await f.login();
  const challenge = await f.call('createChallenge', { address: account.address, public: true });
  await assert.rejects(f.call('verifyChallenge', { id: challenge.id, signature: '0x' + '00'.repeat(65) }));
  assert.equal(f.writes.length, 0);
  assert.equal(addressSyncPending(f.store.client, alice), false);
  queueRemovedAddress(f.store.client, alice, 1, account.address);
  const oldOauth = { restore: async () => ({ getTokenInfo: async () => ({ scope: 'atproto' }), fetchHandler: () => { throw new Error('must not write'); } }) };
  assert.equal(await syncAddresses(f.store.client, oldOauth, alice), false);
  assert.equal(addressSyncPending(f.store.client, alice), true);
});

test('payment and invitation IDs use XRPC inputs; DID and self-payment checks survive migration', async t => {
  const f = fixture(t);
  await f.login();
  await assert.rejects(f.call('resolveRecipient', { identifier: 'alice.test' }), e => e.status === 400);
  const resolved = await f.call('resolveRecipient', { identifier: 'bob.test' });
  assert.equal(resolved.did, bob);
  const created = await f.call('createPayment', { identifier: 'bob.test', expectedDid: bob, amount: '0.01' });
  assert.equal(created.payment.state, 'waiting');
  assert.ok(created.invitationUrl.startsWith(origin + "/invite#invite="));
  const id = created.payment.id;
  assert.equal((await f.query('getPayment', { id })).payment.id, id);
  assert.equal((await f.query('listPayments')).payments.length, 1);
  const invited = await f.call('createInvitation', { id });
  const token = invited.invitationUrl.split('#invite=')[1];
  await assert.rejects(f.query('getInvitation', { token }));
  await f.login(bob);
  assert.equal((await f.query('getInvitation', { token })).payment.id, id);
  const received = (await f.query('getPayment', { id })).payment;
  assert.equal(received.id, id);
  assert.equal('attemptId' in received, false);
  await assert.rejects(f.call('cancelPayment', { id }));
  await assert.rejects(f.call('createInvitation', { id }));
  await f.login(alice);
  assert.equal((await f.call('cancelPayment', { id })).payment.state, 'cancelled');
});

test('outbox insertion failure rolls back the link and leaves the challenge usable', async t => {
  const f = fixture(t);
  await f.login();
  const challenge = await f.call('createChallenge', { address: account.address, public: true });
  const signature = await account.signMessage({ message: challenge.message });
  f.store.client.exec(`CREATE TRIGGER reject_outbox BEFORE INSERT ON kv
    WHEN NEW.namespace LIKE 'address-record:%' BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END`);
  await assert.rejects(f.call('verifyChallenge', { id: challenge.id, signature }), e => e.error === "Conflict");
  assert.equal((await f.query('getSession')).links.length, 0);
  assert.equal(f.writes.length, 0);
  f.store.client.exec('DROP TRIGGER reject_outbox');
  assert.equal((await f.call('verifyChallenge', { id: challenge.id, signature })).links.length, 1);
});

test('concurrent address changes cannot let an old put overtake the latest deletion', async t => {
  const f = fixture(t);
  await f.login();
  f.fail(true);
  const challenge = await f.call('createChallenge', { address: account.address, public: true });
  const signature = await account.signMessage({ message: challenge.message });
  await f.call('verifyChallenge', { id: challenge.id, signature });
  let active = 0;
  let peak = 0;
  const actions = [];
  const oauth = { restore: async () => ({
    getTokenInfo: async () => ({ scope: 'atproto repo:app.peachlet.address' }),
    fetchHandler: async (path) => {
      active++;
      peak = Math.max(active, peak);
      actions.push(path);
      if (path.endsWith('putRecord')) queueRemovedAddress(f.store.client, alice, 1, account.address);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return Response.json({});
    },
  }) };
  await Promise.all(Array.from({ length: 3 }, () => syncAddresses(f.store.client, oauth, alice, message => proof_matches_origin(message, origin))));
  assert.equal(peak, 1);
  assert.deepEqual(actions.map(s => s.split('.').at(-1)), ['putRecord', 'deleteRecord']);
  assert.equal(addressSyncPending(f.store.client, alice), false);
});

test('OAuth login requests collection scope, retains credentials, and rotates session', async t => {
  const f = fixture(t);
  await f.login();
  let authorization;
  f.oauth.authorize = async (_identifier, options) => {
    authorization = options;
    return new URL('https://provider.example/authorize');
  };
  await f.call('startLogin', { identifier: 'alice.test' });
  assert.equal(authorization.scope, 'atproto repo:app.peachlet.address');
  f.oauth.callback = async () => {
    f.store.client.prepare('INSERT INTO kv(namespace,key,value,expires) VALUES(?,?,?,?)')
      .run('oauth-session', alice, '{"retained":true}', Date.now() + 86400000);
    return { session: { did: alice }, state: authorization.state };
  };
  const response = await f.raw('/auth/callback?code=example&state=' + authorization.state);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/');
  assert.ok(f.store.client.prepare("SELECT 1 FROM kv WHERE namespace='oauth-session' AND key=?").get(alice));
  assert.equal((await f.query('getSession')).did, alice);
  assert.equal(f.store.client.prepare("SELECT count(*) AS n FROM kv WHERE namespace='browser'").get().n, 1);
  assert.equal(f.store.client.prepare('SELECT did FROM user_profiles WHERE did=?').get(alice).did, alice);
});

test('payment descriptions stay internal, survive reads, and validate before inserting', async t => {
  const f = fixture(t);
  await f.login();
  const input = { identifier: 'bob.test', expectedDid: bob, amount: '0.01' };
  const created = await f.call('createPayment', { ...input, description: '  Dinner 🍋\nThanks!  ' });
  assert.equal(created.payment.description, 'Dinner 🍋\nThanks!');
  assert.equal(f.store.client.prepare('SELECT description FROM payments WHERE id=?').get(created.payment.id).description, 'Dinner 🍋\nThanks!');
  assert.equal((await f.query('getPayment', { id: created.payment.id })).payment.description, 'Dinner 🍋\nThanks!');
  assert.equal(f.writes.length, 0, 'description is never published to the repository');
  assert.equal((await f.call('createPayment', { ...input, description: ' \n ' })).payment.description, null);
  assert.equal((await f.call('createPayment', input)).payment.description, null);
  const count = f.store.client.prepare('SELECT count(*) AS n FROM payments').get().n;
  await assert.rejects(f.call('createPayment', { ...input, description: 'a'.repeat(501) }), e => e.status === 400);
  await assert.rejects(f.call('createPayment', { ...input, description: 123 }), e => e.status === 400);
  assert.equal(f.store.client.prepare('SELECT count(*) AS n FROM payments').get().n, count);
  await f.login(bob);
  assert.equal((await f.query('listPayments', { direction: 'received' })).total, 3);
  assert.equal((await f.query('getPayment', { id: created.payment.id })).payment.description, 'Dinner 🍋\nThanks!');
  await f.login('did:plc:outsider');
  assert.equal((await f.query('listPayments', { q: 'Dinner' })).total, 0);
  await assert.rejects(f.query('getPayment', { id: created.payment.id }), e => e.error === 'NotFound');
});

test('activity filters run before pagination, sort deterministically, and isolate participants', async t => {
  const f = fixture(t);
  await f.login();
  const now = Date.now();
  const put = f.store.client.prepare(`INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_atomic,state,description,created_at,expires_at)
    VALUES(?,?,?,?,1,'10000000000000000',?,?,?,?)`);
  for (let i = 0; i < 55; i++) put.run(`sent-${String(i).padStart(2,'0')}`, alice, bob, 'bob.test', i === 54 ? 'cancelled' : 'ready', i === 53 ? 'Lunch 100%_ literal' : `Dinner ${i}`, now - i * 1000, now + 600000);
  put.run('received', bob, alice, 'alice.test', 'confirmed', 'Refund', now + 1, now + 600000);
  put.run('expired', alice, bob, 'bob.test', 'waiting', 'Old', now - 100000, now - 1);
  put.run('private', 'did:plc:other', 'did:plc:outsider', 'outsider.test', 'ready', 'Dinner hidden', now + 2, now + 600000);
  f.store.client.prepare('INSERT INTO user_profiles(did,handle,display_name,avatar,updated_at) VALUES(?,?,?,?,?)').run(bob, 'bob.test', 'Robert Peachlet', 'https://cdn.bsky.app/img/avatar/plain/test@jpeg', now);
  let result = await f.query('listPayments', { pageSize: 20 });
  assert.equal(result.total, 57);
  assert.equal(result.payments.length, 20);
  assert.equal(result.payments[0].id, 'received');
  assert.equal(result.payments[0].sender.displayName, 'Robert Peachlet');
  const second = await f.query('listPayments', { pageSize: 20, page: 2 });
  assert.equal(new Set([...result.payments, ...second.payments].map(p => p.id)).size, 40);
  assert.equal((await f.query('listPayments', { page: 3, pageSize: 20 })).payments.length, 17);
  assert.equal((await f.query('listPayments', { direction: 'received' })).total, 1);
  assert.equal((await f.query('listPayments', { direction: 'sent' })).total, 56);
  assert.equal((await f.query('listPayments', { status: 'ready' })).total, 54);
  assert.equal((await f.query('listPayments', { status: 'waiting' })).total, 0);
  assert.equal((await f.query('listPayments', { status: 'expired' })).payments[0].id, 'expired');
  assert.equal((await f.query('listPayments', { q: '100%_' })).payments[0].id, 'sent-53');
  assert.equal((await f.query('listPayments', { q: "' OR 1=1 --" })).total, 0);
  assert.equal((await f.query('listPayments', { q: 'robert peachlet', direction: 'sent' })).total, 56);
  assert.equal((await f.query('listPayments', { after: String(now), before: String(now) })).total, 1);
  assert.equal((await f.query('listPayments', { sort: 'oldest', pageSize: 1 })).payments[0].id, 'expired');
  assert.equal((await f.query('listPayments', { page: 999 })).payments.length, 0);
  assert.equal((await f.raw('/xrpc/app.peachlet.listPayments?page=1.5')).status, 400);
  for (const params of [{ page: 0 }, { pageSize: 51 }, { status: 'unknown' }, { direction: 'unknown' }, { after: String(now), before: String(now-1) }, { q: 'x'.repeat(513) }, { after: 'not-a-date' }, { before: '-1' }]) {
    await assert.rejects(f.query('listPayments', params), e => e.status === 400);
  }
});

test('only senders may delete cancelled intents; prepared, broadcast, and other-user records survive', async t => {
  const f = fixture(t);
  await f.login();
  const { payment } = await f.call('createPayment', { identifier: 'bob.test', expectedDid: bob, amount: '0.1' });
  const id = payment.id;
  await assert.rejects(f.call('deletePayment', { id }), e => e.error === 'Conflict');
  await f.call('cancelPayment', { id });
  await f.login(bob);
  await assert.rejects(f.call('deletePayment', { id }), e => e.error === 'NotFound');
  await f.login(alice);
  for (const state of ['ready','prepared','submitted','confirming','confirmed','failed','expired']) {
    f.store.client.prepare('UPDATE payments SET state=? WHERE id=?').run(state, id);
    await assert.rejects(f.call('deletePayment', { id }), e => e.error === 'Conflict');
  }
  f.store.client.prepare("UPDATE payments SET state='cancelled',tx_hash=? WHERE id=?").run('0x'+'a'.repeat(64), id);
  await assert.rejects(f.call('deletePayment', { id }), e => e.error === 'Conflict');
  f.store.client.prepare('UPDATE payments SET tx_hash=NULL WHERE id=?').run(id);
  assert.equal((await f.call('deletePayment', { id })).ok, true);
  assert.equal((await f.query('listPayments')).total, 0);
  await assert.rejects(f.query('getPayment', { id }), e => e.error === 'NotFound');
  await assert.rejects(f.call('deletePayment', { id }), e => e.error === 'NotFound');
});

test('KLIPY attachments remain participant-only and reject unsafe media URLs', async t => {
  const f = fixture(t);
  await f.login();
  const input = { identifier: 'bob.test', expectedDid: bob, amount: '0.01' };
  const media = { kind: 'clips', slug: 'thank-you', title: 'Thank you', url: 'https://static.klipy.com/test.mp4?delivery=original', preview: 'https://static1.klipy.com/test.webp?delivery=original' };
  const created = await f.call('createPayment', { ...input, description: 'Thanks!', media });
  assert.deepEqual(created.payment.media, media);
  assert.deepEqual(JSON.parse(f.store.client.prepare('SELECT media FROM payments WHERE id=?').get(created.payment.id).media), media);
  assert.deepEqual((await f.query('getPayment', { id: created.payment.id })).payment.media, media);
  assert.deepEqual((await f.query('listPayments')).payments[0].media, media);
  assert.equal((await f.call('createPayment', input)).payment.media, null);
  for (const change of [
    { url: 'javascript:alert(1)' }, { url: 'https://static.klipy.com.evil.test/x' },
    { url: 'https://static.klipy.com@evil.test/x' }, { preview: 'https://example.com/x.webp' },
    { url: 'https://static.klipy.com/\\evil.test/x' }, { kind: 'html' }, { slug: '' },
    { title: 'x'.repeat(301) },
  ]) await assert.rejects(f.call('createPayment', { ...input, media: { ...media, ...change } }), e => e.status === 400);
  await f.login(bob);
  assert.deepEqual((await f.query('getPayment', { id: created.payment.id })).payment.media, media);
  await f.login('did:plc:outsider');
  await assert.rejects(f.query('getPayment', { id: created.payment.id }), e => e.status === 404);
  assert.equal(f.writes.length, 0, 'attachments are never published to AT Protocol');
});

test('native bearer sessions are isolated from cookies and revoked by logout', async t => {
  const f=fixture(t),token='a'.repeat(64),key=createHash('sha256').update(token).digest('hex');
  f.store.client.prepare('INSERT INTO kv(namespace,key,value,expires) VALUES(?,?,?,?)').run('native-session',key,JSON.stringify({did:alice,csrf:'native-csrf',createdAt:Date.now(),scopeVersion:1}),Date.now()+60000);
  const native=async(path,body)=>f.app.fetch(new Request(origin+'/xrpc/app.peachlet.'+path,{method:body?'POST':'GET',headers:{Host:'peachlet.app',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.equal((await (await native('getSession')).json()).did,alice);
  assert.equal((await native('listPayments?q=dinner')).status,200);
  assert.equal((await native('createChallenge',{address:account.address})).status,200);
  assert.equal((await f.raw('/xrpc/app.peachlet.getProfile',{headers:{cookie:'__Host-peachlet='+token}})).status,401);
  await f.login();
  assert.equal((await f.raw('/xrpc/app.peachlet.getProfile',{headers:{Authorization:'Bearer '+'f'.repeat(64)}})).status,401);
  assert.equal((await native('logout',{})).status,200);
  assert.equal((await native('getSession')).status,401);
});

test('notification stream authenticates, replays only the recipient and supports read state',async t=>{
  const f=fixture(t);assert.equal((await f.raw('/xrpc/app.peachlet.subscribeNotifications')).status,401);
  await f.login(bob);
  f.store.client.prepare("INSERT INTO payments(id,sender_did,recipient_did,recipient_label,chain_id,amount_atomic,state,created_at,expires_at) VALUES('notice',?,?,'bob.test',1,'1','confirmed',1,2)").run(alice,bob);
  const listed=await f.query('listNotifications');assert.equal(listed.unread,1);
  const response=await f.raw('/xrpc/app.peachlet.subscribeNotifications?cursor=0');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);assert.equal(response.headers.get('x-accel-buffering'),'no');
  const reader=response.body.getReader();let data='';for(let i=0;i<4&&!data.includes('payment-received');i++){data+=new TextDecoder().decode((await reader.read()).value);}await reader.cancel();assert.match(data,/payment-received/);assert.match(data,/notice/);
  await f.call('markNotificationRead',{id:listed.notifications[0].id});assert.equal((await f.query('listNotifications')).unread,0);
  await f.call('registerPushToken',{token:'ExpoPushToken[http_test]',platform:'android'});await f.call('logout',{});assert.equal(f.store.client.prepare('SELECT count(*) AS n FROM push_devices').get().n,0);
  await f.login(alice);assert.equal((await f.query('listNotifications')).notifications.length,0);
});

test('native OAuth returns only a one-time proof-bound code and preserves browser binding',async t=>{
  const f=fixture(t),verifier='d'.repeat(64),state='e'.repeat(64),challenge=createHash('sha256').update(verifier).digest('hex');let oauthState;
  f.oauth.authorize=async(_identifier,options)=>{oauthState=options.state;return new URL('https://provider.example/authorize');};
  const start=await f.raw(`/auth/native/start?identifier=alice.test&challenge=${challenge}&state=${state}`);assert.equal(start.status,302);
  f.oauth.callback=async()=>({session:{did:alice},state:oauthState});
  assert.equal((await f.raw('/auth/callback?code=test',{headers:{cookie:''}})).status,401);
  const callback=await f.raw('/auth/callback?code=test');assert.equal(callback.status,302);const redirect=new URL(callback.headers.get('location'));assert.equal(redirect.origin,'null');assert.equal(redirect.protocol,'peachlet:');assert.equal(redirect.searchParams.get('state'),state);
  const exchange=body=>f.app.fetch(new Request(origin+'/xrpc/app.peachlet.exchangeNativeSession',{method:'POST',headers:{Host:'peachlet.app','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
  const code=redirect.searchParams.get('code');assert.equal((await exchange({code,verifier:'f'.repeat(64)})).status,401);const response=await exchange({code,verifier});assert.equal(response.status,200);assert.match((await response.json()).token,/^[a-f0-9]{64}$/);assert.equal((await exchange({code,verifier})).status,401);
});


test('browser push endpoints require authentication and CSRF, and logout revokes subscriptions', async t => {
  const f = fixture(t);
  assert.equal((await f.raw('/xrpc/app.peachlet.getWebPushConfig')).status, 401);
  await f.login(bob);
  const settings = await f.query('getWebPushConfig');
  assert.deepEqual(Object.keys(settings), ['publicKey']);
  const ecdh = createECDH('prime256v1');
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/browser-test', p256dh: ecdh.generateKeys().toString('base64url'), auth: randomBytes(16).toString('base64url') };
  assert.equal((await f.raw('/xrpc/app.peachlet.registerWebPush', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': '' }, body: JSON.stringify(subscription) })).status, 403);
  await f.call('registerWebPush', subscription);
  assert.equal(f.store.client.prepare("SELECT platform FROM push_devices").get().platform, 'web');
  await assert.rejects(f.call('registerWebPush', { ...subscription, endpoint: 'https://127.0.0.1/private' }), e => e.status === 400);
  await f.call('logout', {});
  assert.equal(f.store.client.prepare('SELECT count(*) AS n FROM push_devices').get().n, 0);
});

test('native signup uses the configured provider and create prompt with an app callback binding', async t => {
  const f = fixture(t);
  const calls = [];
  f.oauth.authorize = async (identifier, options) => { calls.push({ identifier, options }); return new URL('https://bsky.social/oauth/authorize'); };
  const response = await f.raw('/auth/native/start?create=true&challenge=' + 'a'.repeat(64) + '&state=' + 'b'.repeat(64));
  assert.equal(response.status, 302);
  assert.equal(calls[0].identifier, 'https://bsky.social');
  assert.equal(calls[0].options.prompt, 'create');
  assert.ok(f.store.client.prepare("SELECT value FROM kv WHERE namespace='native-binding' AND key=?").get(calls[0].options.state));
});

test('invitation fallback and Android association are publicly served', async t => {
  const f = fixture(t);
  const association = await f.raw('/.well-known/assetlinks.json');
  assert.equal(association.status, 200);
  assert.match(association.headers.get('content-type'), /application\/json/);
  const [statement] = await association.json();
  assert.equal(statement.target.package_name, 'app.peachlet');
  assert.match(statement.target.sha256_cert_fingerprints[0], /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);
  const page = await f.raw('/invite');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
});

test('asset discovery is wallet-scoped, paginated, and rechecks metadata on-chain', async t => {
  const contract = '0x4444444444444444444444444444444444444444';
  const client = { async getChainId() { return 1; }, async getBalance() { return 1000000000000000000n; },
    async readContract({ functionName }) { return { decimals: 6, symbol: 'REAL', name: 'Verified token', balanceOf: 1234567n }[functionName]; } };
  const f = fixture(t, new Some(new Chain(client)));
  await f.login();
  await assert.rejects(f.query('getAssets', { address: account.address }), e => e.status === 403);
  const challenge = await f.call('createChallenge', { address: account.address, public: false });
  await f.call('verifyChallenge', { id: challenge.id, signature: await account.signMessage({ message: challenge.message }) });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const urls = [];
  const token = { token: { address_hash: contract, decimals: '6', name: 'Indexer name', symbol: 'FAKE', type: 'ERC-20', exchange_rate: '1.01' }, value: '1234567' };
  globalThis.fetch = async url => {
    urls.push(url);
    return Response.json({ items: [token, { ...token, value: '0' }, { ...token, value: (2n ** 256n).toString() }, { token: null }, { ...token, token: { ...token.token, type: 'ERC-721' } }], next_page_params: { id: 42, items_count: 50, value: '1234567', fiat_value: '1.23' } });
  };
  const page = await f.query('getAssets', { address: account.address });
  assert.equal(page.discoveryAvailable, true); assert.equal(page.assets.length, 2);
  assert.equal(page.assets[1].usdPrice, '1.01');
  assert.equal(page.assets[0].asset.kind, 'native'); assert.equal(page.assets[1].asset.symbol, 'FAKE');
  await f.query('getAssets', { address: account.address, cursor: page.cursor });
  assert.match(urls[1], /&id=42/);
  await assert.rejects(f.query('getAssets', { address: account.address, cursor: '{bad' }), e => e.status === 400);
  await assert.rejects(f.query('getAssets', { address: account.address, cursor: '{"url":"https://evil.test"}' }), e => e.status === 400);
  const verified = await f.query('getAsset', { address: account.address, assetId: `eip155:1/erc20:${contract}` });
  assert.equal(verified.asset.symbol, 'REAL'); assert.equal(verified.asset.decimals, 6); assert.equal(verified.balanceAtomic, '1234567');
  await assert.rejects(f.query('getAsset', { address: account.address, assetId: `eip155:2/erc20:${contract}` }), e => e.status === 400);
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  const unavailable = await f.query('getAssets', { address: account.address });
  assert.equal(unavailable.discoveryAvailable, false); assert.equal(unavailable.assets.length, 1);
});

test('network selection is explicit and cannot supply arbitrary server RPC targets', async t => {
  const f = fixture(t);
  await f.login();
  const response = await f.raw('/xrpc/app.peachlet.getSession', { headers: { 'x-peachlet-chain-id': '4326' } });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.network.chainId, 4326);
  assert.deepEqual(session.network.rpcUrls, ['https://mainnet.megaeth.com/rpc']);
  const testnetResponse = await f.raw('/xrpc/app.peachlet.getSession', { headers: { 'x-peachlet-chain-id': '6343' } });
  assert.equal(testnetResponse.status, 200);
  const testnetSession = await testnetResponse.json();
  assert.equal(testnetSession.network.chainId, 6343);
  assert.equal(testnetSession.network.chainIdHex, '0x18c7');
  assert.deepEqual(testnetSession.network.rpcUrls, ['https://carrot.megaeth.com/rpc']);
  assert.equal((await f.query('getSession')).network.chainId, 1);
  for (const invalid of ['31337', '999999', 'https://127.0.0.1/rpc']) {
    const rejected = await f.raw('/xrpc/app.peachlet.getSession', { headers: { 'x-peachlet-chain-id': invalid } });
    assert.equal(rejected.status, 400);
  }
});


for (const network of [mainnet, megaeth, megaeth_testnet]) test(`fee estimates use chain ${network.chain_id} and exact ETH/ERC-20 transactions`, async t => {
  const estimates = [];
  let actualChain = network.chain_id, fail = false;
  const gas = network.chain_id === 1 ? 21000n : 63349n;
  const client = {
    getChainId: async () => actualChain,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 123456789012345678n, maxPriorityFeePerGas: 0n }),
    estimateGas: async tx => { estimates.push(tx); if (fail) throw new Error('execution reverted'); return gas; },
  };
  const f = fixture(t, new Some(new Chain(client)), network);
  const input = { chainId: network.chain_id, from: account.address, to: '0x1111111111111111111111111111111111111111', value: '10000000000000000', data: '0x', nonce: 7 };
  await assert.rejects(f.call('estimateFees', input), e => [401, 403].includes(e.status));
  await f.login();
  await assert.rejects(f.call('estimateFees', input), e => e.status === 403);
  const challenge = await f.call('createChallenge', { address: account.address, public: false });
  await f.call('verifyChallenge', { id: challenge.id, signature: await account.signMessage({ message: challenge.message }) });
  const quote = await f.call('estimateFees', input);
  assert.equal(quote.chainId, network.chain_id);
  assert.equal(quote.gasLimit, gas.toString());
  assert.equal(quote.maxFeeWei, (gas * 123456789012345678n).toString());
  assert.ok(quote.expiresAt > Date.now() && quote.expiresAt <= Date.now() + 60000);
  assert.deepEqual(estimates[0], { account: input.from.toLowerCase(), to: input.to, value: BigInt(input.value), data: '0x', nonce: 7, blockTag: 'pending', maxFeePerGas: 123456789012345678n, maxPriorityFeePerGas: 0n });
  const tokenInput = { ...input, value: '0', data: '0xa9059cbb' + input.to.slice(2).padStart(64, '0') + '123'.padStart(64, '0') };
  const tokenQuote = await f.call('estimateFees', tokenInput);
  assert.equal(tokenQuote.data, tokenInput.data);
  assert.equal(estimates[1].data, tokenInput.data);
  for (const change of [{ chainId: 999 }, { value: '-1' }, { value: '1e18' }, { data: '0x1234' }, { nonce: -1 }, { to: 'bad' }]) {
    await assert.rejects(f.call('estimateFees', { ...input, ...change }), e => e.status === 400);
  }
  assert.equal(estimates.length, 2);
  actualChain = 999;
  await assert.rejects(f.call('estimateFees', input), e => e.status === 503);
  assert.equal(estimates.length, 2);
  actualChain = network.chain_id; fail = true;
  await assert.rejects(f.call('estimateFees', input), e => e.status === 503);
});

test('testnet discovers ERC20 holdings through RPC without an indexer key', async t => {
  const contracts = Array.from({ length: 22 }, (_, i) => '0x' + (i + 1).toString(16).padStart(40, '0'));
  const calls = [];
  let fail = false;
  const client = {
    getChainId: async () => 6343,
    getBalance: async () => 0n,
    request: async input => {
      calls.push(input);
      if (fail) throw new Error('RPC unavailable');
      const logs = contracts.map(address => ({ address, topics: ['transfer', 'from', 'to'] }));
      return [...logs, logs[0], { address: contracts[0], topics: ['transfer', 'from', 'to', 'nft-id'] }];
    },
    readContract: async ({ functionName, address }) => ({ decimals: 6, symbol: 'TEST', name: 'Test token', balanceOf: address.toLowerCase() === contracts[0] ? 0n : 1234567n })[functionName],
  };
  const f = fixture(t, new Some(new Chain(client)), megaeth_testnet);
  await f.login();
  await assert.rejects(f.query('getAssets', { address: account.address }), e => e.status === 403);
  assert.equal(calls.length, 0);
  const challenge = await f.call('createChallenge', { address: account.address, public: false });
  await f.call('verifyChallenge', { id: challenge.id, signature: await account.signMessage({ message: challenge.message }) });
  const page = await f.query('getAssets', { address: account.address });
  assert.equal(page.discoveryAvailable, true);
  assert.equal(page.assets.length, 20); // native + 19 nonzero ERC20s
  assert.equal(page.cursor, 'rpc:20');
  assert.equal(calls[0].method, 'eth_getLogs');
  assert.equal(calls[0].params[0].topics[2], '0x' + account.address.toLowerCase().slice(2).padStart(64, '0'));
  assert.equal(page.assets[1].asset.chainId, 6343);
  const next = await f.query('getAssets', { address: account.address, cursor: page.cursor });
  assert.equal(next.assets.length, 3);
  assert.equal(next.cursor, undefined);
  await assert.rejects(f.query('getAssets', { address: account.address, cursor: 'rpc:-1' }), e => e.status === 400);
  fail = true;
  const unavailable = await f.query('getAssets', { address: account.address });
  assert.equal(unavailable.discoveryAvailable, false);
  assert.equal(unavailable.assets.length, 1);
});


test('web CSP permits curated token logos without allowing arbitrary image hosts', async t => {
  const f = fixture(t);
  const response = await f.raw('/');
  const policy = response.headers.get('content-security-policy');
  const images = policy.split(';').find(rule => rule.trim().startsWith('img-src'));
  for (const host of ['raw.githubusercontent.com', 'assets.coingecko.com', 'coin-images.coingecko.com', 'assets.kraken.com', 's2.coinmarketcap.com', 'www.geckoterminal.com', 'arbitrum.foundation']) assert.ok(images.includes('https://' + host));
  assert.ok(!images.split(' ').includes('https:'));
  assert.ok(policy.includes("script-src 'self'"));
});


test('domain migration never republishes an old signed proof and requires a fresh signature', async t => {
  const f = fixture(t, new None(), megaeth_testnet);
  await f.login();
  const current = await f.call('createChallenge', { address: account.address, public: true });
  const oldMessage = current.message.replaceAll('peachlet.app', 'citruswallet.app');
  const oldSignature = await account.signMessage({ message: oldMessage });
  const created = new Date().toISOString();
  f.store.client.prepare('INSERT INTO links(did,address,chain_id,message,signature,linked_at,public,is_default) VALUES(?,?,?,?,?,?,1,1)')
    .run(alice, account.address.toLowerCase(), 6343, oldMessage, oldSignature, created);
  queueVerifiedAddress(f.store.client, alice, 6343, account.address, true, oldMessage, oldSignature, created);
  assert.equal((await f.query('getSession')).links[0].requires_relink, true);
  assert.equal((await f.call('syncAddresses', {})).addressSyncPending, false);
  assert.equal(f.writes.length, 0);
  let authorization;
  f.oauth.authorize = async (_identifier, options) => { authorization = options; return new URL('https://provider.example/authorize'); };
  await f.call('startLogin', { identifier: 'alice.test' });
  f.oauth.callback = async () => ({ session: { did: alice }, state: authorization.state });
  await f.raw('/auth/callback?code=example&state=' + authorization.state);
  assert.equal(f.writes.length, 0);
  await f.login();
  const challenge = await f.call('createChallenge', { address: account.address, public: true });
  assert.match(challenge.message, /^peachlet.app wants you to sign in/);
  assert.match(challenge.message, /URI: https:\/\/peachlet.app\/wallet-link/);
  await f.call('verifyChallenge', { id: challenge.id, signature: await account.signMessage({ message: challenge.message }) });
  assert.equal((await f.query('getSession')).links[0].requires_relink, false);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].body.collection, 'app.peachlet.address');
  assert.equal(f.writes[0].body.record.message, challenge.message);
});

test('ETH quotes require login, cache valid prices and reject upstream failures', async t => {
  const f = fixture(t);
  await assert.rejects(f.query('getEthPrice'), e => e.status === 401);
  await f.login();
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let hits = 0;
  globalThis.fetch = async url => {
    assert.equal(url, 'https://api.coinbase.com/v2/prices/ETH-USD/spot'); hits++;
    return Response.json({ data: { base: 'ETH', currency: 'USD', amount: '2345.67' } });
  };
  const quote = await f.query('getEthPrice');
  assert.equal(quote.usd, '2345.67'); assert.equal(quote.source, 'Coinbase');
  assert.equal((await f.query('getEthPrice')).updatedAt, quote.updatedAt); assert.equal(hits, 1);
  f.store.client.prepare("DELETE FROM kv WHERE namespace='market-price'").run();
  globalThis.fetch = async () => Response.json({ data: { base: 'BTC', currency: 'USD', amount: '2345' } });
  await assert.rejects(f.query('getEthPrice'), e => e.status === 503);
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  await assert.rejects(f.query('getEthPrice'), e => e.status === 503);
});

test('background requests cannot exhaust the payment action limit and remain rate limited', async t => {
  const f = fixture(t); await f.login();
  let response;
  for (let i = 0; i < 245; i++) response = await f.raw('/xrpc/app.peachlet.getSession');
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('Retry-After')) > 0);
  const payment = await f.raw('/xrpc/app.peachlet.createPayment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(payment.status, 400); // Schema rejection, not throttling; payment budget is intact.
});
