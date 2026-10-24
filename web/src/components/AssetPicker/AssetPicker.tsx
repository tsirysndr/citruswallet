import { AssetLogo } from "../AssetLogo";
import { ChevronDown, Search, X } from "lucide-react";
import { useState, useRef, useId } from "react";
import { formatBalance } from "@peachlet/amounts";
import { useAssets, readAsset, type Asset, nativeAsset } from "../../assets";
import type { Session } from "../../types";
import { ContentSkeleton } from "../ContentSkeleton";
import { Button, Label } from "../ui";
export function AssetPicker({ session, value, onChange }: { session: Session; value: Asset; onChange: (asset: Asset) => void }) {
  const links = (session.links ?? []).filter(link => link.chain_id === session.network.chainId);
  const [wallet, setWallet] = useState("");
  const address = links.some(link => link.address === wallet) ? wallet : links[0]?.address ?? "";
  const inventory = useAssets(session.did, session.network.chainId, address);
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialogId = useId();
  const finishClose = () => { generation.current++; setLoading(false); setOpen(false); trigger.current?.focus(); };
  const close = () => { finishClose(); dialog.current?.close(); };
  const show = () => { setSearch(""); setError(""); setOpen(true); dialog.current?.showModal(); searchInput.current?.focus(); };
  const entries = [...new Map(inventory.data?.pages.flatMap(page => page.assets).map(row => [row.asset.id, row]) ?? []).values()];
  const matches = entries.filter(({ asset }) => `${asset.symbol} ${asset.name} ${asset.contractAddress ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function pick(id: string) {
    const current = ++generation.current; setLoading(true); setError("");
    try { const result = await readAsset(address, id); if (current === generation.current) { onChange(result.asset); close(); } }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : "Could not verify asset."); }
    finally { if (current === generation.current) setLoading(false); }
  }
  return <div className="my-4 space-y-3">
    <Label htmlFor="asset-wallet">Wallet assets</Label>
    {links.length > 0 ? <select id="asset-wallet" className="w-full rounded-md border border-edge bg-sunken p-3 font-mono text-xs" value={address} onChange={event => { generation.current++; setLoading(false); setWallet(event.target.value); onChange(nativeAsset(session.network.chainId)); }}>
      {links.map(link => <option key={link.address} value={link.address}>{link.address}</option>)}
    </select> : <p className="text-xs text-ink-muted">Link a wallet to discover its tokens.</p>}
    <Button ref={trigger} type="button" variant="subtle" className="inline-flex items-center gap-2" aria-label={`${value.symbol} · Choose asset`} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open} onClick={show}><AssetLogo asset={value} size={24} />{value.symbol}<ChevronDown size={16} aria-hidden="true" /></Button>
    {value.contractAddress && <p className="break-all font-mono text-xs text-ink-muted">{value.contractAddress}</p>}
    <dialog ref={dialog} id={dialogId} className="asset-picker-dialog" aria-labelledby={`${dialogId}-title`} onClose={finishClose} onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <h2 id={`${dialogId}-title`} className="sr-only">Choose asset</h2>
      <div className="command-search-field">
        <Search size={20} aria-hidden="true" />
        <input ref={searchInput} type="search" aria-label="Search assets or paste token contract" placeholder="Search name, symbol or contract…" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); if (!loading && address) { if (/^0x[0-9a-fA-F]{40}$/.test(search.trim())) void pick(`eip155:${session.network.chainId}/erc20:${search.trim().toLowerCase()}`); else if (matches.length === 1) void pick(matches[0]!.asset.id); } }
        }} />
        <button type="button" aria-label="Close asset picker" onClick={close}><X size={20} aria-hidden="true" /></button>
      </div>
      {inventory.isPending && address && <ContentSkeleton label="Loading assets" />}
      {(inventory.isError || inventory.data?.pages.some(page => !page.discoveryAvailable)) && <p className="text-xs text-ink-muted">Token discovery is unavailable. Paste a contract address to look it up on-chain.</p>}
      <div className="min-h-0 overflow-y-auto overscroll-contain" aria-busy={loading || inventory.isFetching}>
        {matches.map(({ asset, balanceAtomic }) => <button type="button" key={asset.id} disabled={loading} onClick={() => void pick(asset.id)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-sunken">
          <AssetLogo asset={asset} /><span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex w-full justify-between gap-3"><strong>{asset.symbol}</strong><span className="font-mono text-xs font-bold" title={formatBalance(balanceAtomic, asset.decimals)}>{formatBalance(balanceAtomic, asset.decimals, 6)}</span></span>
          <span className="text-xs text-ink-muted">{asset.name}</span>
          {asset.contractAddress && <span className="break-all font-mono text-xs text-ink-faint">{asset.contractAddress}</span>}
          </span>
        </button>)}
        {!inventory.isPending && !inventory.isError && matches.length === 0 && <p role="status" className="py-8 text-center text-sm text-ink-muted">No assets match your search.</p>}
      </div>
      {inventory.hasNextPage && <Button type="button" variant="subtle" disabled={inventory.isFetchingNextPage} onClick={() => void inventory.fetchNextPage()}>Load more assets</Button>}
      {address && /^0x[0-9a-fA-F]{40}$/.test(search.trim()) && <Button type="button" disabled={loading} onClick={() => void pick(`eip155:${session.network.chainId}/erc20:${search.trim().toLowerCase()}`)}>Look up token</Button>}
      {loading && <ContentSkeleton label="Verifying token" />}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </dialog>
    <p className="text-xs text-ink-muted">Network fees are paid in ETH. Identify tokens by their contract address.</p>
  </div>;
}
