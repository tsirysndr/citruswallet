const mockStorage = new Map();
let mockState = 'loading';
const mockLocalAddress = '0x2222222222222222222222222222222222222222';
const mockExternalAddress = '0x1111111111111111111111111111111111111111';
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async key => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => { mockStorage.set(key, value); }),
}));
jest.mock('../src/local-wallet', () => ({
  nativeVaultState: () => mockState,
  nativeBalanceAddress: () => mockState === 'absent' || mockState === 'loading' ? null : mockLocalAddress,
}));
function freshPreferences() {
  let preferences;
  jest.isolateModules(() => { preferences = require('../src/wallet-preferences'); });
  return preferences;
}
beforeEach(() => { mockStorage.clear(); mockState = 'loading'; });
test.each(['citrus', 'metamask'])('restores %s from secure storage in a fresh app instance', async selection => {
  const first = freshPreferences();
  await first.selectWallet(selection);
  await first.rememberExternalWallet(mockExternalAddress);
  const restarted = freshPreferences();
  await restarted.loadWalletPreference();
  for (const state of ['loading', 'absent', 'locked', 'unlocked']) {
    mockState = state;
    expect(restarted.walletMode()).toBe(selection);
  }
  expect(restarted.configuredAddress()).toBe(selection === 'citrus' ? mockLocalAddress : mockExternalAddress);
});
test('does not substitute the MetaMask address when the selected Citrus vault is absent', async () => {
  mockStorage.set('citrus-wallet-mode', 'citrus');
  mockStorage.set('citrus-metamask-address', mockExternalAddress);
  mockState = 'absent';
  const preferences = freshPreferences();
  await preferences.loadWalletPreference();
  expect(preferences.walletMode()).toBe('citrus');
  expect(preferences.configuredAddress()).toBeNull();
});
