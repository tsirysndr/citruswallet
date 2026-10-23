import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { Account } from '../src/screens/Account';
const address = '0x1111111111111111111111111111111111111111';
let mockLocalAddress = null, mockVaultState = 'absent';
const mockSession = { did: 'did:plc:me', links: [], network: { chainId: 4326, name: 'MegaETH', rpcUrls: ['https://rpc.example'] } };
jest.mock('../src/hooks', () => ({ useSession: () => ({ data: mockSession }), useProfile: () => ({ data: { did: 'did:plc:me', handle: 'me.test' } }), useAction: () => fn => fn() }));
jest.mock('../src/local-wallet', () => ({ nativeBalanceAddress: () => mockLocalAddress, nativeVaultState: () => mockVaultState, subscribeNativeVault: () => () => {} }));
jest.mock('../src/api', () => ({ request: jest.fn(), saveToken: jest.fn() }));
jest.mock('../src/auth', () => ({ signIn: jest.fn() }));
jest.mock('../src/network', () => ({ deviceNetwork: network => network }));
jest.mock('../src/components/AssetBalances', () => ({ AssetBalances: () => null }));
jest.mock('../src/components/HandleInput', () => ({ HandleInput: () => null }));
jest.mock('../src/components/AtmosphereApps', () => ({ AtmosphereApps: () => null }));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<Provider><QueryClientProvider client={client}><Account /></QueryClientProvider></Provider>);
}
beforeEach(() => { mockLocalAddress = null; mockVaultState = 'absent'; mockSession.links = []; global.fetch = jest.fn(); });
test('an empty MegaETH account shows 0 ETH without needing an RPC request', async () => {
  mount(); expect(await screen.findByText('0 ETH')).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
});
test('loads the local wallet even while locked and before it is linked', async () => {
  mockLocalAddress = address; mockVaultState = 'locked';
  fetch.mockResolvedValue({ ok: true, json: async () => ({ result: '0x0' }) });
  mount(); expect(await screen.findByText('0 ETH')).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[0][1].body).params[0]).toBe(address);
});
test('RPC failures are unavailable, not a false zero', async () => {
  mockLocalAddress = address; mockVaultState = 'locked';
  fetch.mockRejectedValue(new Error('offline'));
  mount(); expect(await screen.findByText('Balance unavailable')).toBeTruthy();
  expect(screen.queryByText('0 ETH')).toBeNull();
});
test('asks to unlock legacy wallets whose address is not cached yet', async () => {
  mockVaultState = 'locked'; mount();
  expect(await screen.findByText('Unlock to load balance')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
