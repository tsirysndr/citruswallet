import { AssetLogo } from "../AssetLogo";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import { useAtomValue } from "jotai";
import { busyAtom } from "../../state";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { formatBalance } from "@citruswallet/amounts";
import { useAssets, readAsset, nativeAsset, type Asset } from "../../assets";
import type { Session } from "../../types";
import { Text } from "../Typography";
import { Button, Field } from "../ui";
import { ContentSkeleton } from "../ContentSkeleton";
export function AssetPicker({ session, value, onChange }: { session: Session; value: Asset; onChange: (asset: Asset) => void }) {
  const busy = useAtomValue(busyAtom);
  const links = (session.links ?? []).filter(link => link.chain_id === session.network.chainId);
  const [wallet, setWallet] = useState("");
  const address = links.some(link => link.address === wallet) ? wallet : links[0]?.address ?? "";
  const inventory = useAssets(session.did, session.network.chainId, address);
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const entries = [...new Map(inventory.data?.pages.flatMap(page => page.assets).map(row => [row.asset.id, row]) ?? []).values()];
  async function pick(id: string) {
    const current = ++generation.current; setLoading(true); setError("");
    try { const result = await readAsset(address, id); if (current === generation.current) { onChange(result.asset); setOpen(false); } }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : "Could not verify asset."); }
    finally { if (current === generation.current) setLoading(false); }
  }
  return <View className="gap-2">
    <Pressable accessibilityRole="button" accessibilityLabel={`${value.symbol} · Choose asset`} accessibilityState={{ expanded: open, disabled: busy }} disabled={busy} onPress={() => setOpen(true)} className="min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-white px-4 py-3">
      <AssetLogo asset={value} size={24} /><Text className="text-base font-semibold text-ink">{value.symbol}</Text>
      <ChevronDown size={18} color="#191916" accessible={false} />
    </Pressable>
    {value.contractAddress && <Text selectable className="font-mono text-xs text-muted">{value.contractAddress}</Text>}
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
      <View className="flex-1 gap-3 bg-canvas px-5 pb-8 pt-14">
        <View className="flex-row items-center justify-between"><Text className="text-xl font-bold">Choose asset</Text><Button title="Close" tone="ghost" onPress={() => setOpen(false)} /></View>
        {links.length === 0 && <Text>Link a wallet to discover its tokens.</Text>}
        {links.length > 0 && <ScrollView horizontal className="max-h-14" contentContainerStyle={{ gap: 8 }}>{links.map(link => <Pressable key={link.address} accessibilityRole="button" accessibilityState={{ selected: link.address === address }} onPress={() => { generation.current++; setLoading(false); setWallet(link.address); onChange(nativeAsset(session.network.chainId)); }} className={`rounded-lg p-3 ${link.address === address ? 'bg-lime' : 'bg-white'}`}><Text className="font-mono text-xs">{link.address.slice(0, 8)}…{link.address.slice(-6)}</Text></Pressable>)}</ScrollView>}
        <Field label="Search assets or paste token contract" value={search} onChangeText={setSearch} autoCapitalize="none" onSubmitEditing={() => { if (!busy && !loading && address && /^0x[0-9a-fA-F]{40}$/.test(search.trim())) void pick(`eip155:${session.network.chainId}/erc20:${search.trim().toLowerCase()}`); }} />
        {(inventory.isError || inventory.data?.pages.some(page => !page.discoveryAvailable)) && <Text className="text-sm text-muted">Token discovery is unavailable. Paste a contract address to look it up on-chain.</Text>}
        {error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
        {loading && <ContentSkeleton label="Verifying token" />}
        {address && /^0x[0-9a-fA-F]{40}$/.test(search.trim()) && <Button title="Look up token" disabled={loading} onPress={() => void pick(`eip155:${session.network.chainId}/erc20:${search.trim().toLowerCase()}`)} />}
        <ScrollView className="flex-1" contentContainerStyle={{ gap: 8 }}>
          {inventory.isPending && !!address && <ContentSkeleton label="Loading assets" />}
          {entries.filter(({ asset }) => `${asset.symbol} ${asset.name} ${asset.contractAddress ?? ''}`.toLowerCase().includes(search.toLowerCase())).map(({ asset, balanceAtomic }) => <Pressable key={asset.id} accessibilityRole="button" disabled={loading} onPress={() => void pick(asset.id)} className="flex-row items-center gap-3 rounded-xl bg-white p-4">
            <AssetLogo asset={asset} /><View className="min-w-0 flex-1 gap-2">
            <View className="flex-row justify-between"><Text className="text-base font-semibold">{asset.symbol}</Text><Text className="font-mono text-sm">{formatBalance(balanceAtomic, asset.decimals, 6)}</Text></View>
            <Text className="text-sm text-muted">{asset.name}</Text>
            {asset.contractAddress && <Text className="font-mono text-xs text-muted">{asset.contractAddress}</Text>}
            </View>
          </Pressable>)}
          {inventory.hasNextPage && <Button title="Load more assets" tone="ghost" disabled={inventory.isFetchingNextPage} onPress={() => void inventory.fetchNextPage()} />}
        </ScrollView>
        <Text className="text-xs text-muted">Network fees are paid in ETH. Identify tokens by their contract address.</Text>
      </View>
    </Modal>
  </View>;
}
