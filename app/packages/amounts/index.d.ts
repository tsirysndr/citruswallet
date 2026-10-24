export function normalizeInput(value: string): string;
export function parseAmount(input: string, decimals: number): string;
export function formatAmount(atomic: string, decimals: number): string;
export function formatBalance(atomic: string, decimals: number, places?: number): string;
export function editAmount(current: string, key: string, decimals?: number): string;
export function sumAtomic(values: string[]): string;
export function fiatValue(atomic: string, decimals: number, price: string, places?: number): string;
export function expectedTransfer(payment: {
  address: string | null; chainId: number; amount: string; asset: string;
  amountWei: string; amountAtomic?: string; assetId?: string;
  assetDetails?: { id: string; chain: string; chainId: number; kind: string; contractAddress: string | null; decimals: number };
}): { to: string; value: string; data: string };
export function portfolioUsd(nativeAtomic: string | null, ethPrice: string | undefined, assets: Array<{ address: string; balanceAtomic: string; usdPrice?: string; asset: { id: string; kind: string; chainId: number; contractAddress: string | null; decimals: number } }>, chainId: number): { usd: string | null; missing: number };
export function formatUsd(value: string): string;
