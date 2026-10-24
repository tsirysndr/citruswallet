import {
  QueryClient,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Asset, AssetBalance } from "./lexicon/types/app/peachlet/defs";
import { rpc } from "./api";
export type { Asset, AssetBalance };
export function nativeAsset(chainId: number): Asset {
  return {
    id: `eip155:${chainId}/slip44:60`,
    chain: `eip155:${chainId}`,
    chainId,
    kind: "native",
    contractAddress: null,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  };
}
export type Inventory = {
  assets: AssetBalance[];
  discoveryAvailable: boolean;
  cursor?: string;
};
export function readAssetPage(
  client: QueryClient,
  did: string | null | undefined,
  chainId: number,
  address: string,
  cursor?: string,
) {
  return client.fetchQuery({
    queryKey: ["asset-page", did, chainId, address.toLowerCase(), cursor ?? ""],
    queryFn: () => rpc.getAssets({ address, cursor }),
    staleTime: 60_000,
    retry: false,
  });
}
export function useAssets(
  did: string | null | undefined,
  chainId: number,
  address: string,
) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: ["assets", did, chainId, address],
    enabled: !!did && !!address,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      readAssetPage(client, did, chainId, address, pageParam),
    getNextPageParam: (last, pages) =>
      last.cursor &&
      !pages.slice(0, -1).some((page) => page.cursor === last.cursor)
        ? last.cursor
        : undefined,
    staleTime: 30_000,
  });
}
export async function readAsset(
  address: string,
  assetId: string,
): Promise<AssetBalance> {
  return rpc.getAsset({ address, assetId });
}
