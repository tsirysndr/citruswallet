import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { WalletEntry } from './index';
let mockSession, mockReturning, mockVault;
jest.mock('../../hooks', () => ({ useSession: () => ({ data: mockSession }) }));
jest.mock('../../api', () => ({ hasSignedIn: () => mockReturning }));
jest.mock('../../local-wallet', () => ({ nativeVaultState: () => mockVault, subscribeNativeVault: () => () => {} }));
jest.mock('../../wallet-preferences', () => ({ configuredAddress: () => null }));
jest.mock('../WalletSetup', () => ({ WalletSetup: () => { const { Text } = require('react-native'); return <Text>Step 1</Text>; } }));
jest.mock('../OnboardingSignIn', () => ({ OnboardingSignIn: () => { const { Text } = require('react-native'); return <Text>Sign In</Text>; } }));
beforeEach(() => { mockSession = { did: null }; mockReturning = false; mockVault = 'absent'; });
test('signed-out returning users go to sign-in even when no local wallet is detected', () => {
  mockReturning = true;
  renderComponent(<WalletEntry onFinished={() => {}} />);
  expect(screen.getByText('Sign In')).toBeTruthy();
  expect(screen.queryByText('Step 1')).toBeNull();
});
test('a configured locked wallet goes to sign-in without a history marker', () => {
  mockVault = 'locked';
  renderComponent(<WalletEntry onFinished={() => {}} />);
  expect(screen.getByText('Sign In')).toBeTruthy();
});
test('an expired session returning null still goes to sign-in', () => {
  mockSession = null; mockReturning = true;
  renderComponent(<WalletEntry onFinished={() => {}} />);
  expect(screen.getByText('Sign In')).toBeTruthy();
});
test('a fresh install keeps wallet onboarding', () => {
  renderComponent(<WalletEntry onFinished={() => {}} />);
  expect(screen.getByText('Step 1')).toBeTruthy();
});
test('a signed-in account can complete wallet linking', () => {
  mockSession = { did: 'did:plc:me' }; mockReturning = true;
  renderComponent(<WalletEntry onFinished={() => {}} />);
  expect(screen.getByText('Step 1')).toBeTruthy();
});
