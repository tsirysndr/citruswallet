const { TextEncoder, TextDecoder } = require('node:util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.crypto = require('node:crypto').webcrypto;
const mockStorage = new Map();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async key => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => { mockStorage.set(key, value); }),
  deleteItemAsync: jest.fn(async key => { mockStorage.delete(key); }),
  canUseBiometricAuthentication: () => false,
}));
const vault = require('../src/local-wallet');
const secret = { kind: 'mnemonic', value: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' };
beforeEach(async () => { vault.lockNativeWallet(); mockStorage.clear(); await vault.loadNativeVault(); });
afterEach(() => vault.lockNativeWallet());
test('native wallet encrypts storage with a separate device key and unlocks only with the PIN', async () => {
  await vault.createNativeVault(secret, '793184');
  expect(vault.nativeVaultState()).toBe('unlocked');
  expect(mockStorage.get('citrus-vault-v1')).not.toContain('abandon');
  expect(mockStorage.get('citrus-vault-device-key-v1')).toHaveLength(64);
  vault.lockNativeWallet();
  expect(vault.nativeAddress()).toBeNull();
  expect(vault.nativeBalanceAddress()).toBe("0x9858EfFD232B4033E47d90003D41EC34EcaEda94");
  await vault.loadNativeVault();
  expect(vault.nativeBalanceAddress()).toBe("0x9858EfFD232B4033E47d90003D41EC34EcaEda94");
  await vault.unlockNativeVault('793184');
  expect(vault.nativeAddress()).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  await expect(vault.createNativeVault(secret, '793184')).rejects.toThrow('already exists');
});
test('wrong PIN remains locked and repeated attempts are throttled', async () => {
  await vault.createNativeVault(secret, '793184'); vault.lockNativeWallet();
  await expect(vault.unlockNativeVault('000000')).rejects.toThrow('Unable to unlock');
  expect(vault.nativeVaultState()).toBe('locked');
  await expect(vault.unlockNativeVault('000000')).rejects.toThrow('Wait a moment');
});
test('an interrupted native unlock cannot restore the in-memory signing key', async () => {
  await vault.createNativeVault(secret, '793184'); vault.lockNativeWallet();
  const unlocking = vault.unlockNativeVault('793184'); vault.lockNativeWallet();
  await expect(unlocking).rejects.toThrow('interrupted');
  expect(vault.nativeAddress()).toBeNull();
});
