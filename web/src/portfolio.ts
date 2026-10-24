import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { portfolioUsd, formatUsd } from '@peachlet/amounts';
import type { Session } from './types';
import { readAssetPage, type Inventory } from './assets';
import { rpc } from './api';

export function usePortfolio(session: Session | null | undefined, nativeAtomic: string | null, extraAddress?: string | null) {
  const client = useQueryClient();
  const chainId = session?.network.chainId ?? 0;
  const supported = [1, 4326, 6343].includes(chainId) && session?.network.nativeCurrency.symbol === 'ETH';
  const addresses = [...new Set(session?.links.filter(link => link.chain_id === chainId).map(link => link.address.toLowerCase()) ?? [])];
  const price = useQuery({ queryKey: ['eth-usd'], enabled: !!session?.did && supported,
    queryFn: () => rpc.getEthPrice(), staleTime: 60_000, refetchInterval: 60_000, retry: false });
  const wallets = useQueries({ queries: addresses.map(address => ({
    queryKey: ['portfolio-assets', session?.did, chainId, address], enabled: !!session?.did && supported,
    queryFn: async ({ signal }) => {
      const assets: Inventory['assets'] = []; const seen = new Set<string>();
      let cursor: string | undefined;
      let complete = true;
      for (let page = 0; page < 20; page++) {
        const result: Inventory = await readAssetPage(client, session?.did, chainId, address, cursor);
        if (signal.aborted) throw new Error('Portfolio request cancelled');
        assets.push(...result.assets); complete &&= result.discoveryAvailable;
        if (!result.cursor) return { assets, complete };
        if (seen.has(result.cursor)) return { assets, complete: false };
        seen.add(result.cursor); cursor = result.cursor;
      }
      return { assets, complete: false };
    }, staleTime: 120_000, refetchInterval: 180_000, retry: false,
  })) });
  const fresh = (at: number) => Date.now() - at < 300_000;
  const value = portfolioUsd(nativeAtomic, !price.isError && price.data && fresh(price.data.updatedAt) ? price.data.usd : undefined,
    wallets.flatMap(wallet => !wallet.isError && fresh(wallet.dataUpdatedAt) ? wallet.data?.assets ?? [] : []), chainId);
  const loading = supported && (price.isPending || wallets.some(wallet => wallet.isPending));
  const partial = value.missing > 0 || wallets.some(wallet => wallet.isError || !wallet.data?.complete || !fresh(wallet.dataUpdatedAt)) || Boolean(extraAddress && !addresses.includes(extraAddress.toLowerCase()));
  return { supported, loading, partial, formatted: supported && value.usd !== null ? formatUsd(value.usd) : null };
}
