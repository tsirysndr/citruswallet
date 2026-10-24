import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

function walletFixture({ mobile = true, injected, connectError } = {}) {
  const calls = [];
  const listeners = new Map();
  const events = [];
  const wallet = { request: async ({ method }) => {
    calls.push(method);
    if (method === 'eth_chainId') return '0x1';
    if (method === 'eth_getBalance') return '0x1';
    return ['0xabc'];
  }, once() {}, on(name, fn) { listeners.set(name, fn); }, removeListener(name) { listeners.delete(name); } };
  const client = { status: 'disconnected', getProvider: () => wallet,
    connect: async () => { calls.push('connect'); listeners.get('display_uri')?.('metamask://connect/mwp?p=original&c=1'); if (connectError) throw connectError; client.status = 'connected'; } };
  const source = stripTypeScriptTypes(readFileSync('web/src/wallet.ts', 'utf8'))
    .replace(/^import\s[^;]*;/gm, '').replace(/export /g, '');
  const api = runInNewContext(source + '\n({ connectWallet, readBalances, checkWallet, walletAccount, provider })', {
    window: { ethereum: injected, dispatchEvent(event) { events.push(event); } }, Event, CustomEvent,
    localBalanceAddress: () => null, localWalletState: () => "absent", configureLocalNetwork() {},
    isMobileWalletBrowser: () => mobile, mobileWalletClient: async () => client,
  });
  return { api, wallet, calls, events, listeners };
}
const network = { chainId: 1, chainIdHex: '0x1' };
const session = { did: 'did:plc:alice', network, links: [] };

test('mobile balances never open MetaMask; an explicit connection enables reads', async () => {
  const { api, wallet, calls } = walletFixture();
  assert.equal((await api.readBalances(session)).address, null);
  assert.deepEqual(calls, []);
  assert.equal(await api.connectWallet(network), wallet);
  assert.equal((await api.readBalances(session)).address, '0xabc');
  await api.connectWallet(network);
  assert.equal(calls.filter(c => c === 'connect').length, 1);
  assert.ok(!calls.includes('eth_sendTransaction'));
  assert.ok(!calls.includes('personal_sign'));
});

test('rejected app connections leave no connected provider or balance prompts', async () => {
  const denied = Object.assign(new Error('Rejected'), { code: 4001 });
  const { api, calls } = walletFixture({ connectError: denied });
  await assert.rejects(api.connectWallet(network), { code: 4001 });
  assert.throws(() => api.provider());
  assert.equal((await api.readBalances(session)).address, null);
  assert.deepEqual(calls, ['connect']);
});

test('injected MetaMask takes precedence on both desktop and mobile', async () => {
  const injected = { isMetaMask: true, request: async () => [] };
  for (const mobile of [true, false]) {
    const { api, calls } = walletFixture({ mobile, injected });
    assert.equal(await api.connectWallet(network), injected);
    assert.deepEqual(calls, []);
  }
  await assert.rejects(walletFixture({ mobile: false }).api.connectWallet(network), /MetaMask/);
});

test('account and network changes still stop signing/payment continuation', async () => {
  const { api, wallet } = walletFixture();
  await api.checkWallet(wallet, '0xABC', network);
  await assert.rejects(api.checkWallet(wallet, '0xdef', network), /Account or network changed/);
  await assert.rejects(api.checkWallet(wallet, '0xabc', { chainIdHex: '0x2' }), /Account or network changed/);
});

test('mobile UI includes iPad desktop mode but does not treat desktop as app detection', async () => {
  const source = stripTypeScriptTypes(readFileSync('web/src/mobile-wallet.ts', 'utf8'))
    .replace(/^import\s[^;]*;/gm, '').replace(/export /g, '');
  for (const [userAgent, platform, maxTouchPoints, expected] of [
    ['iPhone', 'iPhone', 5, true], ['Android', 'Linux', 5, true],
    ['Mozilla Macintosh', 'MacIntel', 5, true],
    ['Mozilla Macintosh', 'MacIntel', 0, false], ['Windows', 'Win32', 0, false],
  ]) {
    assert.equal(runInNewContext(source + '\nisMobileWalletBrowser()', {
      navigator: { userAgent, platform, maxTouchPoints },
    }), expected);
  }
});


test('pending connection exposes the original request and clears retry state on success or rejection', async () => {
  for (const connectError of [undefined, new Error('Rejected')]) {
    const { api, events, listeners } = walletFixture({ connectError });
    if (connectError) await assert.rejects(api.connectWallet(network));
    else await api.connectWallet(network);
    const requests = events.filter(event => event.type === 'citrus:metamask-request');
    assert.equal(requests[0].detail, 'metamask://connect/mwp?p=original&c=1');
    assert.equal(requests.at(-1).detail, null);
    assert.equal(listeners.size, 0);
  }
});
