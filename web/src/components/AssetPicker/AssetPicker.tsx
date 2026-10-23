import { useState, useRef } from "react";
import { formatBalance } from "@citruswallet/amounts";
import { useAssets, readAsset, type Asset, nativeAsset } from "../../assets";
import type { Session } from "../../types";
import { ContentSkeleton } from "../ContentSkeleton";
import { Button, Input, Label } from "../ui";
export function AssetPicker({ session, value, onChange }: { session: Session; value: Asset; onChange: (asset: Asset) => void }) {
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
  return <div className="my-4 space-y-3">
    <Label htmlFor="asset-wallet">Wallet assets</Label>
    {links.length > 0 ? <select id="asset-wallet" className="w-full rounded-md border border-edge bg-sunken p-3 font-mono text-xs" value={address} onChange={event => { generation.current++; setLoading(false); setWallet(event.target.value); onChange(nativeAsset(session.network.chainId)); }}>
      {links.map(link => <option key={link.address} value={link.address}>{link.address}</option>)}
    </select> : <p className="text-xs text-ink-muted">Link a wallet to discover its tokens.</p>}
    <Button type="button" variant="subtle" aria-expanded={open} onClick={() => setOpen(!open)}>{value.symbol} · Choose asset</Button>
    {value.contractAddress && <p className="break-all font-mono text-xs text-ink-muted">{value.contractAddress}</p>}
    {open && <div className="space-y-3 rounded-md border border-edge bg-sunken p-3">
      <Input aria-label="Search assets or paste token contract" placeholder="Search assets or paste token contract" value={search} onChange={event => setSearch(event.target.value)} />
      {inventory.isPending && address && <ContentSkeleton label="Loading assets" />}
      {(inventory.isError || inventory.data?.pages.some(page => !page.discoveryAvailable)) && <p className="text-xs text-ink-muted">Token discovery is unavailable. Paste a contract address to look it up on-chain.</p>}
      <div className="max-h-64 overflow-y-auto">
        {entries.filter(({ asset }) => `${asset.symbol} ${asset.name} ${asset.contractAddress ?? ""}`.toLowerCase().includes(search.toLowerCase())).map(({ asset, balanceAtomic }) => <button type="button" key={asset.id} disabled={loading} onClick={() => void pick(asset.id)} className="flex w-full flex-col gap-1 border-b border-edge p-3 text-left hover:bg-panel">
          <span className="flex w-full justify-between gap-3"><strong>{asset.symbol}</strong><span className="font-mono text-xs" title={formatBalance(balanceAtomic, asset.decimals)}>{formatBalance(balanceAtomic, asset.decimals, 6)}</span></span>
          <span className="text-xs text-ink-muted">{asset.name}</span>
          {asset.contractAddress && <span className="break-all font-mono text-xs text-ink-faint">{asset.contractAddress}</span>}
        </button>)}
      </div>
      {inventory.hasNextPage && <Button type="button" variant="subtle" disabled={inventory.isFetchingNextPage} onClick={() => void inventory.fetchNextPage()}>Load more assets</Button>}
      {address && /^0x[0-9a-fA-F]{40}$/.test(search.trim()) && <Button type="button" disabled={loading} onClick={() => void pick(`eip155:${session.network.chainId}/erc20:${search.trim().toLowerCase()}`)}>Look up token</Button>}
      {loading && <ContentSkeleton label="Verifying token" />}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>}
    <p className="text-xs text-ink-muted">Network fees are paid in ETH. Identify tokens by their contract address.</p>
  </div>;
}
