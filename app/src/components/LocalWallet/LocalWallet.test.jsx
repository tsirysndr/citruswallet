import React from 'react';
import { screen, fireEventAsync as fireEvent, waitFor } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { LocalWallet } from './index';
let mockState = 'absent', mockProtection = 'legacy-pin';
jest.mock('../../local-wallet', () => ({ nativeVaultState: () => mockState, subscribeNativeVault: () => () => {}, nativeProtection: () => mockProtection, deviceUnlockAvailable: jest.fn(async () => true), deviceAuthenticationActive: () => false, createProtectedNativeVault: jest.fn(), unlockNativeVault: jest.fn(), nativeAddress: () => null, readNativeSecret: jest.fn() }));
const { createProtectedNativeVault } = require('../../local-wallet');
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
test('defaults to device unlock and validates optional password confirmation before saving', async () => {
  renderComponent(<LocalWallet initialAction="import" />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Device PIN or biometrics · selected' })).toBeTruthy());
  expect(screen.queryByLabelText('Wallet password')).toBeNull();
  expect(screen.queryByLabelText('Create a wallet PIN (6–12 digits)')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Recovery words'), phrase);
  await fireEvent.press(screen.getByRole('button', { name: 'Use a wallet password' }));
  await fireEvent.changeText(screen.getByLabelText('Wallet password'), 'short');
  await fireEvent.changeText(screen.getByLabelText('Repeat password'), 'different');
  await fireEvent(screen.getByLabelText('Repeat password'), 'submitEditing');
  expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
  expect(screen.getByText('Passwords do not match.')).toBeTruthy();
  expect(createProtectedNativeVault).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Wallet password'), 'a long wallet password');
  await fireEvent.changeText(screen.getByLabelText('Repeat password'), 'a long wallet password');
  await fireEvent(screen.getByLabelText('Repeat password'), 'submitEditing');
  expect(createProtectedNativeVault).toHaveBeenCalledWith({ kind: 'mnemonic', value: phrase }, 'password', 'a long wallet password');
});


test('keyboard Enter unlocks a locked wallet and modal cancellation stays beside the action', async () => {
  mockState = 'locked'; mockProtection = 'password';
  const cancel = jest.fn();
  try {
    renderComponent(<LocalWallet onDismiss={cancel} />);
    await fireEvent.changeText(screen.getByLabelText('Wallet password'), 'my password');
    await fireEvent(screen.getByLabelText('Wallet password'), 'submitEditing');
    expect(require('../../local-wallet').unlockNativeVault).toHaveBeenCalledWith('my password');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledTimes(1);
  } finally { mockState = 'absent'; mockProtection = 'legacy-pin'; }
});
