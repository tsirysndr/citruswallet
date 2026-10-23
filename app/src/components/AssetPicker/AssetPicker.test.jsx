import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { AssetPicker } from './AssetPicker';
import { request } from '../../api';
import { nativeAsset } from '../../assets';
jest.mock('../../api', () => ({ request: jest.fn() }));
const address = '0x1111111111111111111111111111111111111111';
const token = { ...nativeAsset(1), id: 'eip155:1/erc20:0x4444444444444444444444444444444444444444', kind: 'erc20', contractAddress: '0x4444444444444444444444444444444444444444', symbol: 'USDC', name: 'USD Coin', decimals: 6 };
test('chooses a discovered asset only after checking its metadata on-chain', async () => {
  request.mockImplementation(async method => method === 'getAssets' ? { assets: [{ asset: token, balanceAtomic: '1234567', address }], discoveryAvailable: true } : { asset: { ...token, symbol: 'VERIFIED' }, balanceAtomic: '1234567', address });
  const selected = jest.fn();
  renderComponent(<AssetPicker session={{ did: 'did:plc:alice', network: { chainId: 1 }, links: [{ chain_id: 1, address }] }} value={nativeAsset(1)} onChange={selected} />);
  fireEvent.press(screen.getByRole('button', { name: 'ETH · Choose asset' }));
  fireEvent.press(await screen.findByText('USDC'));
  await waitFor(() => expect(selected).toHaveBeenCalledWith(expect.objectContaining({ decimals: 6, symbol: 'VERIFIED' })));
  expect(request).toHaveBeenCalledWith('getAsset', undefined, { address, assetId: token.id });
});
