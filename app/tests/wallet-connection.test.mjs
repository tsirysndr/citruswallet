import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { nativeWalletUI, withWalletDeadline } from '../src/wallet-connection.ts';

test('wallet deadlines release the UI and preserve success and errors', async () => {
  assert.equal(await withWalletDeadline(Promise.resolve('connected'), 20, 'timeout'), 'connected');
  const error = new Error('User declined');
  await assert.rejects(withWalletDeadline(Promise.reject(error), 20, 'timeout'), error);
  await assert.rejects(withWalletDeadline(new Promise(() => {}), 5, 'Connection timed out'), /Connection timed out/);
});

test('real native MetaMask SDK opens a session deep link without mounting an install modal', { timeout: 3000 }, async (t) => {
  // Exercise the installed SDK routing, not a mock of connect(). Only native
  // storage and network I/O are replaced; no wallet or relay is contacted.
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@react-native-async-storage/async-storage') {
        return { url: 'data:text/javascript,' + encodeURIComponent(`
          const values = new Map();
          export default { getItem: async k => values.get(k) ?? null,
            setItem: async (k,v) => { values.set(k,v); },
            removeItem: async k => { values.delete(k); } };
        `), shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = globalThis.window;
  const originalSocket = globalThis.WebSocket;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { product: 'ReactNative' } });
  globalThis.window = globalThis;
  globalThis.WebSocket = class { close() { this.onclose?.({ code: 1000 }); } send() {} };
  let sdk;
  try {
    const { createMultichainClient } = await import('../node_modules/@metamask/connect-multichain/dist/react-native/es/connect-multichain.mjs');
    let opened;
    const launch = new Promise(resolve => { opened = resolve; });
    sdk = await createMultichainClient({
      dapp: { name: 'Peachlet test', url: 'https://peachlet.app' },
      api: { supportedNetworks: {} }, analytics: { enabled: false },
      ui: nativeWalletUI,
      mobile: { useDeeplink: true, preferredOpenLink: opened },
    });
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    // The relay is deliberately left pending after the SDK produces the link.
    void sdk.connect(['eip155:1'], [], {}).catch(() => {});
    const uri = await withWalletDeadline(launch, 1500, 'SDK never opened MetaMask');
    assert.match(uri, /^metamask:\/\/connect\/mwp\?/);
    assert.ok(new URL(uri).search.length > 50, 'link carries the pending session');
  } finally {
    t.mock.timers.reset();
    hook.deregister();
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
    globalThis.window = originalWindow;
    globalThis.WebSocket = originalSocket;
  }
});
