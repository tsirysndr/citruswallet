import { afterEach, expect, it, vi } from 'vitest';
import { normalizeSecret } from '@citruswallet/wallet-core';
import { configureLocalNetwork, localProvider, lockLocalWallet, saveLocalWallet } from './local-wallet';
vi.hoisted(() => { vi.resetModules(); });
const mocks = vi.hoisted(() => ({ chain: vi.fn(async () => 1), prepare: vi.fn(async (tx: any) => ({ ...tx, gas: tx.gas, maxFeePerGas: tx.maxFeePerGas })), sign: vi.fn(async () => '0xdead'), broadcast: vi.fn(async () => '0xhash'), approve: vi.fn(async () => true) }));
vi.mock('viem', async original => ({ ...await original<typeof import('viem')>(), createPublicClient: () => ({ getChainId: mocks.chain }), createWalletClient: () => ({ prepareTransactionRequest: mocks.prepare, signTransaction: mocks.sign, sendRawTransaction: mocks.broadcast }) }));
vi.mock('./fee-quote', () => ({ estimateFees: vi.fn(async (tx: any, chainId: number) => ({ ...tx, chainId, value: BigInt(tx.value).toString(), nonce: Number(BigInt(tx.nonce)), gasLimit: '63349', maxFeePerGas: '1000000', maxPriorityFeePerGas: '0', maxFeeWei: '63349000000', expiresAt: Date.now() + 60000 })) }));
vi.mock('./wallet-approval', () => ({ answerApproval: vi.fn(), requestApproval: mocks.approve }));
const secret = normalizeSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'mnemonic');
const network = { chainId: 1, chainIdHex: '0x1', name: 'Ethereum mainnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.example'] };
const tx = { from: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', to: '0x1111111111111111111111111111111111111111', value: '0x1', nonce: '0x7', chainId: '0x1', data: '0x' };
afterEach(() => { lockLocalWallet(); });
async function setup() { await saveLocalWallet(secret, 'a long test password'); configureLocalNetwork(network); }
it('preserves the server-reserved nonce and waits for explicit approval before signing', async () => {
  await setup();
  await localProvider.request({ method: 'eth_sendTransaction', params: [tx] });
  expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ nonce: 7, to: tx.to, value: 1n, gas: 63349n, maxFeePerGas: 1000000n }));
  expect(mocks.approve).toHaveBeenCalled();
  expect(mocks.sign).toHaveBeenCalledOnce();
  expect(mocks.broadcast).toHaveBeenCalledWith({ serializedTransaction: '0xdead' });
});
it('does not sign when RPC chain differs or sender differs', async () => {
  await setup(); mocks.chain.mockResolvedValueOnce(4326);
  await expect(localProvider.request({ method: 'eth_sendTransaction', params: [tx] })).rejects.toThrow('different network');
  await expect(localProvider.request({ method: 'eth_sendTransaction', params: [{ ...tx, from: tx.to }] })).rejects.toThrow('sender changed');
  expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.broadcast).not.toHaveBeenCalled();
});
it('locking while approval is open prevents signing', async () => {
  await setup(); mocks.approve.mockImplementationOnce(async () => { lockLocalWallet(); return true; });
  await expect(localProvider.request({ method: 'eth_sendTransaction', params: [tx] })).rejects.toThrow('Wallet locked');
  expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.broadcast).not.toHaveBeenCalled();
});
it('a rejected confirmation does not sign or broadcast', async () => {
  await setup(); mocks.approve.mockResolvedValueOnce(false);
  await expect(localProvider.request({ method: 'eth_sendTransaction', params: [tx] })).rejects.toMatchObject({ code: 4001 });
  expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.broadcast).not.toHaveBeenCalled();
});

it('rejects a quote that expires during confirmation before signing', async () => {
  await setup();
  const now = Date.now();
  mocks.approve.mockImplementationOnce(async () => { vi.spyOn(Date, 'now').mockReturnValue(now + 180000); return true; });
  try { await expect(localProvider.request({ method: 'eth_sendTransaction', params: [tx] })).rejects.toThrow('expired'); }
  finally { vi.restoreAllMocks(); }
  expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.broadcast).not.toHaveBeenCalled();
});
