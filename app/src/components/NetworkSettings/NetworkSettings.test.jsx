import React from 'react';
import { screen, fireEventAsync as fireEvent } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { NetworkSettings } from './index';
jest.mock('../../hooks', () => ({ useSession: () => ({ data: { network: { chainId: 4326 } } }), useAction: () => fn => fn() }));
jest.mock('../../network', () => ({ currentRpc: () => '', selectedChain: () => '4326', saveNetwork: jest.fn() }));
jest.mock('../../local-wallet', () => ({ lockNativeWallet: jest.fn() }));
const { saveNetwork } = require('../../network');
test('blocks insecure custom RPCs before saving, and accepts an empty default URL', async () => {
  renderComponent(<NetworkSettings />);
  await fireEvent.changeText(screen.getByLabelText('Custom HTTPS RPC (optional)'), 'http://rpc.example.com');
  await fireEvent(screen.getByLabelText('Custom HTTPS RPC (optional)'), 'submitEditing');
  expect(screen.getByRole('alert')).toHaveTextContent(/HTTPS/);
  expect(saveNetwork).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Custom HTTPS RPC (optional)'), '');
  await fireEvent(screen.getByLabelText('Custom HTTPS RPC (optional)'), 'submitEditing');
  expect(saveNetwork).toHaveBeenCalledWith('4326', '');
});

test('selects and saves MegaETH testnet separately from mainnet', async () => {
  saveNetwork.mockClear();
  renderComponent(<NetworkSettings />);
  await fireEvent.press(screen.getByRole('button', { name: 'MegaETH testnet' }));
  expect(screen.getByText('For testing only. Testnet ETH has no real value.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save network' }));
  expect(saveNetwork).toHaveBeenCalledWith('6343', '');
});
