import { expect, it } from 'vitest';
import { accountBalance } from './balances';
import { session, linkedAddress, address } from './test/mocks/fixtures';
it('shows zero for an empty account on the selected network', () => {
  expect(accountBalance(session, undefined)).toContain('0 ETH');
  expect(accountBalance({ ...session, network: { ...session.network, chainId: 4326 }, links: [linkedAddress] }, undefined)).toContain('0 ETH');
});
it('shows a confirmed zero but never treats unavailable linked balances as zero', () => {
  const linked = { ...session, links: [linkedAddress] };
  expect(accountBalance(linked, undefined)).toBeNull();
  expect(accountBalance(session, { address: null, onNetwork: false, wei: {}, unavailable: true })).toBeNull();
  expect(accountBalance(linked, { address, onNetwork: true, wei: { [address]: '0x0' } })).toContain('0 ETH');
});
it('includes the unlinked local wallet and deduplicates it against linked addresses', () => {
  localStorage.setItem('citrus:encrypted-wallet:v1', '{}');
  localStorage.setItem('citrus:wallet-public-address:v1', address);
  const balances = { address: null, onNetwork: true, wei: { [address]: '1000000000000000000' } };
  expect(accountBalance(session, balances)).toBe('1 ETH across 1 address');
  expect(accountBalance({ ...session, links: [linkedAddress] }, balances)).toBe('1 ETH across 1 address');
  expect(accountBalance(session, undefined)).toBeNull();
});
it('does not display zero for a legacy locked vault whose address has not been cached yet', () => {
  localStorage.setItem('citrus:encrypted-wallet:v1', '{}');
  expect(accountBalance(session, undefined)).toBeNull();
});
