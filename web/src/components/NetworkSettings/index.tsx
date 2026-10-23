import { useState } from 'react';
import { useSession } from '../../queries';
import { selectedChain, validateRpc } from '../../network';
import { lockLocalWallet } from '../../local-wallet';
import { Button, Heading, Hint, Input, Label, Panel } from '../ui';
export function NetworkSettings() {
  const { data: session } = useSession();
  const [chain, setChain] = useState(selectedChain() || String(session?.network.chainId || 4326));
  const [rpc, setRpc] = useState(localStorage.getItem(`citrus:rpc:${chain}`) || '');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <Panel><Heading>Network</Heading><Hint className="mt-2">MegaETH is the default. Each network has separate balances. Switching does not move your funds.</Hint>
    <form className="mt-4 flex flex-col gap-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try {
      const url = rpc.trim() ? await validateRpc(rpc.trim(), Number(chain)) : '';
      if (url) localStorage.setItem(`citrus:rpc:${chain}`, url); else localStorage.removeItem(`citrus:rpc:${chain}`);
      localStorage.setItem('citrus:chain', chain); lockLocalWallet(); window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not change network.'); } finally { setBusy(false); } }}>
      <Label htmlFor="wallet-network">Use network</Label><select id="wallet-network" value={chain} onChange={e => { setChain(e.target.value); setRpc(localStorage.getItem(`citrus:rpc:${e.target.value}`) || ''); }}><option value="4326">MegaETH</option><option value="1">Ethereum mainnet</option>{session?.network.chainId === 31337 && <option value="31337">Anvil local</option>}</select>
      <details><summary>Advanced: custom RPC</summary><Label htmlFor="wallet-rpc">HTTPS RPC URL (optional)</Label><Input id="wallet-rpc" type="url" autoComplete="off" value={rpc} onChange={e => setRpc(e.target.value)} /><Hint>Your RPC provider can see your address and transactions. Citrus independently verifies payments with its own RPC.</Hint></details>
      <Button type="submit" disabled={busy}>Save network</Button>{error && <p role="alert" className="text-bad">{error}</p>}
    </form></Panel>;
}
