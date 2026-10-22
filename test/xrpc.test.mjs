import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { XrpcClient } from '@atproto/xrpc';
import { schemas } from '../src/generated/lexicons.mjs';
import { lexicons } from '../src/xrpc.mjs';
import { syncAddresses, queueRemovedAddress, addressSyncPending } from '../src/address-records.mjs';
import { build } from '../build/dev/javascript/citruswallet/citruswallet/app.mjs';
import { Settings } from '../build/dev/javascript/citruswallet/citruswallet/xrpc/context.mjs';
import * as storeModule from '../build/dev/javascript/citruswallet/citruswallet/store.mjs';
import * as oauthModule from '../build/dev/javascript/citruswallet/citruswallet/oauth.mjs';
import { mainnet } from '../build/dev/javascript/citruswallet/citruswallet/network.mjs';
import { Directory } from '../build/dev/javascript/citruswallet/citruswallet/directory.mjs';
import { Identity } from '../build/dev/javascript/citruswallet/citruswallet/identity.mjs';
import { None, Some } from '../build/dev/javascript/gleam_stdlib/gleam/option.mjs';
import { Ok, toList } from '../build/dev/javascript/citruswallet/gleam.mjs';

const origin = 'https://citruswallet.app';
const alice = 'did:plc:alice';
const bob = 'did:plc:bob';
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const env = { incoming: { socket: { remoteAddress: '127.0.0.1', remoteFamily: 'IPv4', remotePort: 10000 } } };

function fixture(t) {
  const opened = storeModule.open(':memory:', './drizzle');
  assert.ok(opened instanceof Ok);
  const store = opened[0];
  t.after(() => storeModule.close(store));
  let failPds = false;
  const writes = [];
  const oauth = {
    clientMetadata: { scope: 'atproto repo:app.citruswallet.address' },
    restore: async () => ({
      getTokenInfo: async () => ({ scope: 'atproto repo:app.citruswallet.address' }),
      fetchHandler: async (path, options) => {
        writes.push({ path, body: JSON.parse(options.body) });
        return Response.json(failPds ? { error: 'Unavailable' } : { uri: 'at://record', cid: 'test' }, { status: failPds ? 503 : 200 });
      },
    }),
  };
  const directory = new Directory(async () => new Ok(toList([])), async () => new Ok(new None()));
  const lookup = async identifier => new Ok(new Identity(identifier?.[0] === 'alice.test' ? alice : bob, new Some('bob.test')));
  const app = build(new Settings(store, oauth, origin, 0, mainnet, lookup, directory, 'https://bsky.social', new None(), './web/dist'));
  let cookie = '';
  let csrf = '';
  async function raw(path, options = {}) {
    const response = await app.fetch(new Request(origin + path, {
      ...options,
      headers: { Host: 'citruswallet.app', Origin: origin, cookie, 'x-csrf-token': csrf, ...Object.fromEntries(new Headers(options.headers)) },
    }), env);
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  const client = new XrpcClient(raw, schemas);
  const call = (name, body) => client.call('app.citruswallet.' + name, undefined, body).then(r => r.data);
  const query = (name, params) => client.call('app.citruswallet.' + name, params).then(r => r.data);
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
  assert.equal(realOauth.clientMetadata.scope, 'atproto repo:app.citruswallet.address');
  assert.deepEqual(realOauth.clientMetadata.redirect_uris, [origin + '/auth/callback']);
  assert.equal((await f.raw('/api/session')).status, 404);
  await assert.rejects(f.query('getProfile'), e => e.status === 401);
  let response = await f.raw('/xrpc/app.citruswallet.createChallenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
  await f.login();
  await assert.rejects(f.call('createChallenge', { address: 123 }), e => e.status === 400 && e.error === 'InvalidRequest');
  assert.equal((await f.raw('/xrpc/app.citruswallet.getPayment?id=one&id=two')).status, 400);
  response = await f.raw('/xrpc/app.citruswallet.getSession', { headers: { Host: 'evil.test' } });
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
    assert.equal(write.body.collection, 'app.citruswallet.address');
    assert.equal(write.body.rkey, `eip155-1-${account.address.toLowerCase()}`);
    if (isPublic) {
      assert.match(write.path, /putRecord$/);
      assert.equal(write.body.record.chain, 'eip155:1');
      assert.equal(write.body.record.address, account.address.toLowerCase());
      assert.equal(write.body.record.signature, signature);
      assert.ok(lexicons.validate('app.citruswallet.address', write.body.record).success);
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
  assert.ok(created.invitationUrl.startsWith(origin));
  const id = created.payment.id;
  assert.equal((await f.query('getPayment', { id })).payment.id, id);
  assert.equal((await f.query('listPayments')).payments.length, 1);
  const invited = await f.call('createInvitation', { id });
  const token = invited.invitationUrl.split('#invite=')[1];
  await assert.rejects(f.query('getInvitation', { token }));
  await f.login(bob);
  assert.equal((await f.query('getInvitation', { token })).payment.id, id);
  await assert.rejects(f.query('getPayment', { id }));
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
    getTokenInfo: async () => ({ scope: 'atproto repo:app.citruswallet.address' }),
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
  await Promise.all(Array.from({ length: 3 }, () => syncAddresses(f.store.client, oauth, alice)));
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
  assert.equal(authorization.scope, 'atproto repo:app.citruswallet.address');
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
