import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from '../../queries';
import { selectedChain, validateRpc } from '../../network';
import { lockLocalWallet } from '../../local-wallet';
import { networkForm } from '../../wallet-validation';
import { Button, FieldError, Heading, Hint, Input, Label, Panel } from '../ui';
export function NetworkSettings() {
  const { data: session } = useSession();
  const initial = selectedChain() || String(session?.network.chainId || 4326);
  const form = useForm({ resolver: zodResolver(networkForm(session?.network.chainId === 31337)), defaultValues: { chain: initial as '4326' | '6343' | '1' | '31337', rpc: localStorage.getItem(`citrus:rpc:${initial}`) || '' } });
  const [error, setError] = useState('');
  return <Panel><Heading>Network</Heading><Hint className="mt-2">MegaETH is the default. Each network has separate balances. Switching does not move your funds.</Hint>
    <form noValidate className="mt-4 flex flex-col gap-3" onSubmit={form.handleSubmit(async ({ chain, rpc }) => {
      setError('');
      try {
        const url = rpc ? await validateRpc(rpc, Number(chain)) : '';
        if (url) localStorage.setItem(`citrus:rpc:${chain}`, url); else localStorage.removeItem(`citrus:rpc:${chain}`);
        localStorage.setItem('citrus:chain', chain); lockLocalWallet(); window.location.reload();
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not change network.'); }
    })}>
      <Label htmlFor="wallet-network">Use network</Label><select id="wallet-network" {...form.register('chain', { onChange: e => form.setValue('rpc', localStorage.getItem(`citrus:rpc:${e.target.value}`) || '', { shouldValidate: form.formState.isSubmitted }) })}><option value="4326">MegaETH</option><option value="1">Ethereum mainnet</option><option value="6343">MegaETH testnet</option>{session?.network.chainId === 31337 && <option value="31337">Anvil local</option>}</select>
      {form.watch('chain') === '6343' && <Hint>For testing only. Testnet ETH has no real value.</Hint>}
      <FieldError>{form.formState.errors.chain?.message}</FieldError>
      <details open={!!form.formState.errors.rpc || undefined}><summary>Advanced: custom RPC</summary><Label htmlFor="wallet-rpc">HTTPS RPC URL (optional)</Label><Input id="wallet-rpc" type="url" autoComplete="off" {...form.register('rpc')} aria-invalid={!!form.formState.errors.rpc} /><FieldError>{form.formState.errors.rpc?.message}</FieldError><Hint>Your RPC provider can see your address and transactions. Citrus independently verifies payments with its own RPC.</Hint></details>
      <Button type="submit" disabled={form.formState.isSubmitting}>Save network</Button>{error && <p role="alert" className="text-bad">{error}</p>}
    </form></Panel>;
}
