import type { FeeTransaction, FeeQuote } from '@citruswallet/wallet-core';
export async function estimateFees(transaction: FeeTransaction, chainId: number): Promise<FeeQuote> {
  const { request } = await import('./api');
  return request<FeeQuote>('estimateFees', { chainId, from: transaction.from, to: transaction.to,
    value: BigInt(transaction.value).toString(), data: transaction.data, nonce: Number(BigInt(transaction.nonce)) });
}
