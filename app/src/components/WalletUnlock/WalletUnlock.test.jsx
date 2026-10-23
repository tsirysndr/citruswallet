import React from 'react';
import { screen, fireEventAsync as fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { createStore } from 'jotai';
import { renderComponent } from '../../../tests/render';
import { readyAtom } from '../../state';
import { finishUnlock, unlockSnapshot } from '../../wallet-unlock';
import { WalletUnlock } from './index';
let mockMode = 'citrus', mockProtection = 'password';
jest.mock('../../wallet-preferences', () => ({ walletMode: () => mockMode }));
jest.mock('../../local-wallet', () => ({ nativeVaultState: () => 'locked', subscribeNativeVault: () => () => {}, nativeProtection: () => mockProtection, lockNativeWallet: jest.fn(), unlockNativeVault: jest.fn(async () => {}) }));
jest.mock('../LocalWallet', () => ({ LocalWallet: () => { const { Text } = require('react-native'); return <Text>Wallet unlock form</Text>; } }));
beforeEach(() => { jest.clearAllMocks(); mockMode = 'citrus'; mockProtection = 'password'; Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' }); });
afterEach(() => { cleanup(); finishUnlock(false); });
function mount() { const store = createStore(); store.set(readyAtom, true); renderComponent(<WalletUnlock />, { store }); }
test('automatically opens password unlock, and cancellation does not reopen it', async () => {
  mount(); expect(await screen.findByText('Wallet unlock form')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(unlockSnapshot()).toBe(false);
  expect(screen.queryByText('Wallet unlock form')).toBeNull();
});
test('directly triggers system authentication for a device-protected wallet', async () => {
  mockProtection = 'device'; mount();
  await waitFor(() => expect(require('../../local-wallet').unlockNativeVault).toHaveBeenCalledWith(''));
  expect(require('../../local-wallet').unlockNativeVault).toHaveBeenCalledTimes(1);
});
test('does not prompt for an unselected local wallet', () => {
  mockMode = 'metamask'; mount(); expect(unlockSnapshot()).toBe(false);
});
test('does not request device authentication while the app is in the background', () => {
  AppState.currentState = 'background'; mockProtection = 'device'; mount();
  expect(unlockSnapshot()).toBe(false);
  expect(require('../../local-wallet').unlockNativeVault).not.toHaveBeenCalled();
});
test('a wallet action joins an automatic unlock instead of opening a second prompt', async () => {
  const { requestUnlock } = require('../../wallet-unlock');
  const automatic = requestUnlock(), payment = requestUnlock();
  expect(payment).toBe(automatic);
  finishUnlock(true);
  await expect(payment).resolves.toBeUndefined();
});
