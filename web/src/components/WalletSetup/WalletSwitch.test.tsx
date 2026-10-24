import { beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { WalletSetup } from './index';
import { renderComponent, screen } from '../../test/render';
import { server } from '../../test/mocks/server';
import { xrpc } from '../../test/mocks/handlers';
import { address, linkedAddress, session } from '../../test/mocks/fixtures';
import { busyAtom } from '../../atoms';
import { createStore } from 'jotai';
import { requestUnlock } from '../../wallet-unlock';

vi.mock('../../wallet-unlock', () => ({ requestUnlock: vi.fn(async () => {}) }));

const state = vi.hoisted(() => ({ vault: 'locked' }));
vi.mock('../../local-wallet', async importOriginal => ({
  ...await importOriginal<typeof import('../../local-wallet')>(),
  localWalletState: () => state.vault,
  localBalanceAddress: () => state.vault === 'absent' ? null : '0x2222222222222222222222222222222222222222',
  subscribeWallet: () => () => {},
}));
beforeEach(() => { state.vault = 'locked'; vi.mocked(requestUnlock).mockClear(); });

it('switches stored wallets without signing or changing the receiving default, and restores selection', async () => {
  const local = '0x2222222222222222222222222222222222222222';
  localStorage.setItem('citrus:metamask-address', address);
  server.use(http.get(xrpc('getSession'), () => HttpResponse.json({ ...session, links: [linkedAddress, { ...linkedAddress, address: local }] })));
  const request = vi.fn();
  window.ethereum = { isMetaMask: true, request };
  const view = await renderComponent(<WalletSetup />);
  expect(await screen.findByRole('radio', { name: 'Peachlet' })).toBeChecked();
  await view.user.click(screen.getByRole('radio', { name: 'MetaMask' }));
  expect(localStorage.getItem('citrus:wallet-mode')).toBe('metamask');
  expect(screen.getByText(address)).toBeVisible();
  expect(screen.queryByText(local)).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  expect(requestUnlock).not.toHaveBeenCalled();
  view.unmount();
  const restored = await renderComponent(<WalletSetup />);
  expect(await screen.findByRole('radio', { name: 'MetaMask' })).toBeChecked();
  await restored.user.click(screen.getByRole('radio', { name: 'Peachlet' }));
  expect(screen.getByText(local)).toBeVisible();
  expect(localStorage.getItem('citrus:wallet-mode')).toBe('citrus');
  expect(requestUnlock).toHaveBeenCalledTimes(1);
});

it('offers setup when switching to a Peachlet wallet that does not exist', async () => {
  state.vault = 'absent';
  localStorage.setItem('citrus:wallet-mode', 'metamask');
  localStorage.setItem('citrus:metamask-address', address);
  const { user } = await renderComponent(<WalletSetup />);
  await user.click(await screen.findByRole('radio', { name: 'Peachlet' }));
  expect(screen.getByRole('button', { name: /Create a Peachlet wallet/ })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Restore a wallet' })).toBeVisible();
});

it('prevents switching while a wallet operation is in progress', async () => {
  const store = createStore();
  store.set(busyAtom, true);
  await renderComponent(<WalletSetup />, { store });
  expect(await screen.findByRole('radio', { name: 'MetaMask' })).toBeDisabled();
});
