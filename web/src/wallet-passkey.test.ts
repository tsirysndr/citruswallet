import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ backup: vi.fn(), vault: vi.fn(), save: vi.fn(), encrypt: vi.fn(), decrypt: vi.fn(), create: vi.fn(), get: vi.fn() }));
vi.mock('./local-wallet', () => ({ backupLocalWallet: mocks.backup, encryptedLocalWallet: mocks.vault, saveUnlockedSecret: mocks.save }));
vi.mock('@citruswallet/wallet-core', () => ({ randomBytes: (n: number) => new Uint8Array(n), encryptSecret: mocks.encrypt, decryptSecret: mocks.decrypt }));
import { enableWalletPasskey, unlockWithPasskey } from './wallet-passkey';
const key = 'citrus:wallet-passkey:v1';
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { create: mocks.create, get: mocks.get } });
  mocks.backup.mockResolvedValue({ kind: 'privateKey', value: 'test-only' });
  mocks.vault.mockReturnValue({ ciphertext: 'original' });
  mocks.encrypt.mockResolvedValue({ ciphertext: 'wrapped' });
  mocks.decrypt.mockResolvedValue({ kind: 'privateKey', value: 'test-only' });
  mocks.create.mockResolvedValue({ rawId: new Uint8Array([1, 2]).buffer, getClientExtensionResults: () => ({}) });
  mocks.get.mockImplementation(async () => ({ getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(32).fill(7).buffer } } }) }));
});
it('allows provider selection and verifies PRF even when creation omits its support flag', async () => {
  await enableWalletPasskey('password');
  expect(mocks.create.mock.calls[0]![0].publicKey.authenticatorSelection.authenticatorAttachment).toBeUndefined();
  expect(mocks.get.mock.calls[0]![0].publicKey.userVerification).toBe('required');
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ id: '0102', vaultCiphertext: 'original' });
  await unlockWithPasskey();
  expect(mocks.decrypt).toHaveBeenCalledWith({ ciphertext: 'wrapped' }, '07'.repeat(32));
  expect(mocks.save).toHaveBeenCalled();
});
it.each([undefined, new ArrayBuffer(0), new ArrayBuffer(16)])('never enables unlock without a valid PRF result', async first => {
  localStorage.setItem(key, 'existing enrollment');
  mocks.get.mockResolvedValue({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });
  await expect(enableWalletPasskey('password')).rejects.toThrow('passkey provider');
  expect(mocks.encrypt).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe('existing enrollment');
});
it('does not enroll a cancelled passkey', async () => {
  mocks.create.mockResolvedValue(null);
  await expect(enableWalletPasskey('password')).rejects.toThrow('cancelled');
  expect(localStorage.getItem(key)).toBeNull();
});
it('does not associate a passkey with a wallet changed during enrollment', async () => {
  mocks.vault.mockReturnValueOnce({ ciphertext: 'original' }).mockReturnValue({ ciphertext: 'changed' });
  await expect(enableWalletPasskey('password')).rejects.toThrow('wallet changed');
  expect(localStorage.getItem(key)).toBeNull();
});
