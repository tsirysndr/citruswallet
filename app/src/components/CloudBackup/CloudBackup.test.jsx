import React from 'react';
import { screen, fireEventAsync as fireEvent, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { renderComponent } from '../../../tests/render';
import { CloudBackup } from './index';
import { createProtectedNativeVault } from '../../local-wallet';
import { restoreCloudBackup } from '@peachlet/wallet-core';
jest.mock('../../cloud-auth', () => ({ cloudConfigured: () => true, connectCloud: jest.fn(async () => 'token') }));
jest.mock('../../wallet-preferences', () => ({ selectWallet: jest.fn(async () => {}) }));
jest.mock('../../local-wallet', () => ({ nativeVaultState: () => 'absent', subscribeNativeVault: () => () => {}, nativeProtection: () => 'device', deviceUnlockAvailable: jest.fn(async () => true), createProtectedNativeVault: jest.fn(async () => {}) }));
jest.mock('@peachlet/wallet-core', () => ({ listCloudBackups: jest.fn(async () => [{ id: 'backup1', name: 'peachlet-test.json' }]), downloadCloudBackup: jest.fn(async () => 'encrypted-only'), restoreCloudBackup: jest.fn(async () => ({ kind: 'privateKey', value: 'test-secret' })) }));
beforeEach(() => { jest.clearAllMocks(); Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); });
test('restores encrypted cloud backup using device protection by default', async () => {
  const done = jest.fn(); renderComponent(<CloudBackup onRestored={done} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Dropbox' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'peachlet-test.json' }));
  await fireEvent.changeText(screen.getByLabelText('Backup password'), 'test backup password');
  await fireEvent.press(screen.getByRole('button', { name: 'Restore wallet' }));
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  expect(createProtectedNativeVault).toHaveBeenCalledWith({ kind: 'privateKey', value: 'test-secret' }, 'device', '');
});
test('failed decryption never creates a local wallet', async () => {
  restoreCloudBackup.mockRejectedValueOnce(new Error('Wrong backup password'));
  renderComponent(<CloudBackup />);
  await fireEvent.press(screen.getByRole('button', { name: 'Dropbox' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'peachlet-test.json' }));
  await fireEvent.changeText(screen.getByLabelText('Backup password'), 'wrong backup password');
  await fireEvent.press(screen.getByRole('button', { name: 'Restore wallet' }));
  expect(await screen.findByText('Wrong backup password')).toBeTruthy();
  expect(createProtectedNativeVault).not.toHaveBeenCalled();
});

test('shows both provider buttons with horizontal logo and label content', async () => {
  renderComponent(<CloudBackup />);
  expect(screen.getByRole('button', { name: 'Google Drive' })).toHaveStyle({ backgroundColor: '#ffffff', minHeight: 52 });
  expect(screen.getByRole('button', { name: 'Dropbox' })).toHaveStyle({ backgroundColor: '#0061ff', minHeight: 52 });
  expect(screen.getByTestId('google-button-content')).toHaveStyle({ flexDirection: 'row', alignItems: 'center' });
  expect(screen.getByTestId('dropbox-button-content')).toHaveStyle({ flexDirection: 'row', alignItems: 'center' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dropbox' })).toBeEnabled());
});
