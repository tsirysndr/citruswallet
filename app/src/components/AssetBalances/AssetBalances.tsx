import { AssetLogo } from "../AssetLogo";
import { ScrollView, View } from "react-native";
import { formatBalance } from "@peachlet/amounts";
import { useAssets } from "../../assets";
import type { Session } from "../../types";
import { ContentSkeleton } from "../ContentSkeleton";
import { Text } from "../Typography";
import { Button } from "../ui";
function WalletAssets({ session, address, hidden }: { session: Session; address: string; hidden: boolean }) {
  const query = useAssets(session.did, session.network.chainId, address);
  const entries = [...new Map(query.data?.pages.flatMap(page => page.assets).map(row => [row.asset.id, row]) ?? []).values()];
  return <View className="gap-3">
    <Text selectable className="font-mono text-xs text-muted">{address}</Text>
    {query.isPending && <ContentSkeleton label="Loading assets" />}
    {(query.isError || query.data?.pages.some(page => !page.discoveryAvailable)) && <Text className="text-xs text-muted">Some token balances are unavailable. Try refreshing.</Text>}
    <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }}>{entries.map(({ asset, balanceAtomic }) => <View key={asset.id} className="flex-row items-center gap-3 border-b border-edge py-3"><AssetLogo asset={asset} /><View className="min-w-0 flex-1 gap-1">
      <View className="flex-row justify-between gap-3"><Text className="text-base font-semibold">{asset.symbol}</Text><Text className="flex-1 text-right font-mono text-sm font-bold">{hidden ? "••••••" : formatBalance(balanceAtomic, asset.decimals)}</Text></View>
      <Text className="text-xs text-muted">{asset.name}</Text>
      {asset.contractAddress && <Text selectable className="font-mono text-xs text-muted">{asset.contractAddress}</Text>}
    </View></View>)}</ScrollView>
    {query.hasNextPage && <Button title="Load more assets" tone="plain" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />}
  </View>;
}
export function AssetBalances({ session, hidden }: { session: Session; hidden: boolean }) {
  const links = (session.links ?? []).filter(link => link.chain_id === session.network.chainId);
  if (!links.length) return null;
  return <View className="gap-5 rounded-3xl bg-white p-5"><Text className="text-xl font-semibold">Your assets</Text>{links.map(link => <WalletAssets key={link.address} session={session} address={link.address} hidden={hidden} />)}</View>;
}
