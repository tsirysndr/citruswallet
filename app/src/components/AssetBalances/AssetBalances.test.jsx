import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderComponent } from '../../../tests/render';
import { AssetBalances } from './AssetBalances';
import { request } from '../../api';
import { nativeAsset } from '../../assets';
jest.mock('../../api', () => ({ request: jest.fn() }));
test('keeps each asset separate and hides balances when requested', async () => {
  const address = '0x1111111111111111111111111111111111111111';
  request.mockResolvedValue({ discoveryAvailable: true, assets: [
    { asset: nativeAsset(1), address, balanceAtomic: '1000000000000000001' },
    { asset: { ...nativeAsset(1), id: 'token', symbol: 'USDC', decimals: 6 }, address, balanceAtomic: '1234567' },
  ] });
  renderComponent(<AssetBalances session={{ did: 'did:plc:alice', network: { chainId: 1 }, links: [{ address, chain_id: 1 }, { address: "0x2222222222222222222222222222222222222222", chain_id: 1 }] }} hidden />);
  expect(await screen.findAllByText('••••••')).toHaveLength(4);
  expect(screen.getByText('Account 1')).toBeTruthy();
  expect(screen.getByText('Account 2')).toBeTruthy();
  expect(screen.getByLabelText(address).props.children.join('')).toBe('0x111111…111111');
  expect(screen.getAllByText('ETH')[0]).toBeTruthy(); expect(screen.getAllByText('USDC')[0]).toBeTruthy();
  expect(screen.queryByText('1.234567')).toBeNull();
});
