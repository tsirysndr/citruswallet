import { afterEach, expect, it, vi } from 'vitest';
import { normalizeSecret } from '@peachlet/wallet-core';
import { renderComponent, screen } from '../../test/render';
import { LocalWallet } from './LocalWallet';
import { backupLocalWallet, localWalletState, lockLocalWallet, saveLocalWallet, unlockLocalWallet } from '../../local-wallet';
const secret = normalizeSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'mnemonic');
afterEach(() => { lockLocalWallet(); });
it('defaults to creating or restoring a wallet, without requiring MetaMask', async () => {
  const { user } = await renderComponent(<LocalWallet />);
  await user.click(screen.getByRole('button', { name: 'I already have a wallet' }));
  expect(screen.getByLabelText('Recovery words, in order')).toBeVisible();
  expect(screen.getByLabelText('Protect this wallet with a password')).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('Recovery words, in order')).not.toBeInTheDocument();
});
it('persists only ciphertext, locks, rejects incorrect credentials, and restores the same wallet', async () => {
  await saveLocalWallet(secret, 'a long test password');
  expect(localWalletState()).toBe('unlocked');
  expect(localStorage.getItem('citrus:encrypted-wallet:v1')).not.toContain('abandon');
  lockLocalWallet();
  await expect(unlockLocalWallet('wrong password')).rejects.toThrow('Unable to unlock');
  expect(localWalletState()).toBe('locked');
  await unlockLocalWallet('a long test password');
  expect(localWalletState()).toBe('unlocked');
  await expect(saveLocalWallet(secret, 'another long password')).rejects.toThrow('already exists');
});
it('backgrounding during unlock cannot leave a wallet unlocked', async () => {
  await saveLocalWallet(secret, 'a long test password'); lockLocalWallet();
  const unlocking = unlockLocalWallet('a long test password');
  lockLocalWallet();
  await expect(unlocking).rejects.toThrow('interrupted');
  expect(localWalletState()).toBe('locked');
  vi.useFakeTimers();
  vi.useRealTimers();
});
it('requires reauthentication to reveal a backup', async () => {
  await saveLocalWallet(secret, 'a long test password');
  await expect(backupLocalWallet('incorrect password')).rejects.toThrow('Unable to unlock');
});
it('only offers password setup after the three missing words are selected', async () => {
  const { within } = await import('@testing-library/react');
  const { user } = await renderComponent(<LocalWallet />);
  await user.click(screen.getByRole('button', { name: 'Create a wallet' }));
  const words = within(screen.getByRole('list', { name: 'Recovery words' })).getAllByRole('listitem').map(item => item.textContent!.replace(/^\d+\.\s*/, ''));
  expect(screen.queryByRole('button', { name: 'Save my wallet' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'I’ve saved my recovery phrase' }));
  for (let step = 0; step < 3; step++) {
    const choices = screen.getByRole('group');
    const index = Number(choices.getAttribute('aria-label')!.match(/\d+/)![0]) - 1;
    await user.click(within(choices).getByRole('button', { name: words[index]! }));
  }
  expect(screen.getByLabelText('Protect this wallet with a password')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save my wallet' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Back to recovery phrase' }));
  expect(screen.queryByRole('button', { name: 'Save my wallet' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
});
