import React from 'react';
import { screen, fireEventAsync as fireEvent, waitFor } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { WalletSetup } from './index';
const mockAddress = '0x1111111111111111111111111111111111111111';
const mockError = jest.fn();
let mockDid = 'did:plc:me';
let mockVault = 'absent', mockMode = 'metamask', mockLinks = [];
const mockLocalAddress = '0x2222222222222222222222222222222222222222';
jest.mock('../../hooks', () => ({ useSession: () => ({ data: { did: mockDid, network: { chainId: 1 }, links: mockLinks } }), useAction: () => fn => fn().catch(mockError) }));
jest.mock('../../local-wallet', () => ({ nativeVaultState: () => mockVault, subscribeNativeVault: () => () => {}, nativeBalanceAddress: () => mockVault === 'absent' ? null : mockLocalAddress }));
jest.mock('../../wallet-preferences', () => ({ configuredAddress: () => mockVault === 'absent' ? null : mockMode === 'citrus' ? mockLocalAddress : mockAddress, walletMode: () => mockMode, selectWallet: jest.fn(async value => { mockMode = value; }), rememberExternalWallet: jest.fn() }));
jest.mock('../../wallet-unlock', () => ({ requestUnlock: jest.fn(async () => {}) }));
jest.mock('../../wallet', () => ({ connect: jest.fn(), linkWallet: jest.fn() }));
jest.mock('../../auth', () => ({ signIn: jest.fn(async () => false) }));
jest.mock('../../api', () => ({ request: jest.fn() }));
jest.mock('../LocalWallet', () => ({ LocalWallet: () => null }));
const { linkWallet, connect } = require('../../wallet');
const { request } = require('../../api');
beforeEach(() => { jest.clearAllMocks(); mockVault = 'absent'; mockMode = 'metamask'; mockLinks = []; mockDid = 'did:plc:me'; connect.mockResolvedValue({ address: mockAddress }); linkWallet.mockResolvedValue(mockAddress); request.mockResolvedValue({}); });
test('sets the verified account as default without opening a second connection', async () => {
  renderComponent(<WalletSetup onFinished={() => {}} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Connect MetaMask' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Link my wallet' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Open Citrus Wallet' })).toBeTruthy());
  expect(linkWallet).toHaveBeenCalledWith({ chainId: 1 }, true);
  expect(request).toHaveBeenCalledWith('setDefaultAddress', { address: mockAddress });
  expect(connect).not.toHaveBeenCalled();
});
test('keeps setup open when receiving-default update fails', async () => {
  request.mockRejectedValue(new Error('Offline'));
  renderComponent(<WalletSetup onFinished={() => {}} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Connect MetaMask' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Link my wallet' }));
  expect(mockError).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Open Citrus Wallet' })).toBeNull();
});

test('anonymous connection ends with handle sign-in and does not finish onboarding', async () => {
  mockDid = null;
  const finished = jest.fn();
  renderComponent(<WalletSetup onFinished={finished} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Connect MetaMask' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Connect MetaMask' }));
  expect(screen.getByText(/using an @handle instead of a long wallet address/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open Citrus Wallet' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Handle'), 'alice.test');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
  expect(require('../../auth').signIn).toHaveBeenCalledWith('alice.test', false);
  expect(finished).not.toHaveBeenCalled();
  expect(linkWallet).not.toHaveBeenCalled();
});


test('switches wallets and only unlocks Citrus without linking or moving funds', async () => {
  mockVault = 'locked'; mockMode = 'citrus';
  mockLinks = [mockAddress, mockLocalAddress].map(address => ({ address, chain_id: 1 }));
  const view = renderComponent(<WalletSetup />);
  expect(screen.getByRole('radio', { name: 'Citrus Wallet' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'MetaMask' }));
  expect(require('../../wallet-preferences').selectWallet).toHaveBeenCalledWith('metamask');
  expect(screen.getByText(mockAddress)).toBeTruthy();
  expect(screen.queryByText(mockLocalAddress)).toBeNull();
  expect(require('../../wallet-unlock').requestUnlock).not.toHaveBeenCalled();
  view.unmount();
  renderComponent(<WalletSetup />);
  expect(screen.getByRole('radio', { name: 'MetaMask' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Citrus Wallet' }));
  expect(screen.getByText(mockLocalAddress)).toBeTruthy();
  expect(require('../../wallet-unlock').requestUnlock).toHaveBeenCalledTimes(1);
  expect(linkWallet).not.toHaveBeenCalled();
  expect(connect).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

test('offers creation and restoration when Citrus is not configured', async () => {
  renderComponent(<WalletSetup />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Citrus Wallet' }));
  expect(screen.getByRole('button', { name: 'Create a Citrus wallet' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Restore a wallet' })).toBeTruthy();
  expect(require('../../wallet-unlock').requestUnlock).not.toHaveBeenCalled();
});

test('keeps the selected wallet when saving the selection fails', async () => {
  require('../../wallet-preferences').selectWallet.mockRejectedValueOnce(new Error('Storage unavailable'));
  renderComponent(<WalletSetup />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Citrus Wallet' }));
  expect(screen.getByRole('radio', { name: 'MetaMask' })).toBeChecked();
  expect(mockError).toHaveBeenCalled();
  expect(require('../../wallet-unlock').requestUnlock).not.toHaveBeenCalled();
});

test('disables wallet switching during an active wallet operation', async () => {
  const store = require('jotai').createStore();
  store.set(require('../../state').busyAtom, true);
  renderComponent(<WalletSetup />, { store });
  const citrus = screen.getByRole('radio', { name: 'Citrus Wallet' });
  expect(citrus).toBeDisabled();
  await fireEvent.press(citrus);
  expect(require('../../wallet-preferences').selectWallet).not.toHaveBeenCalled();
});

test.each([false, true])('shows sign-in for an existing locked wallet after sign-out, restart=%s', async restart => {
  mockVault = 'locked'; mockMode = 'citrus'; mockDid = null;
  renderComponent(<WalletSetup restart={restart} onFinished={() => {}} />);
  expect(await screen.findByText('Welcome back.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  expect(screen.queryByText('WALLET SETUP')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create a Citrus wallet' })).toBeNull();
  expect(require('../../wallet-unlock').requestUnlock).not.toHaveBeenCalled();
  expect(require('../../wallet-preferences').selectWallet).not.toHaveBeenCalled();
});
