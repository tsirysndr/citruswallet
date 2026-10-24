import { useSyncExternalStore } from 'react';
import { localWalletState, subscribeWallet } from '../../local-wallet';
import { requestUnlock } from '../../wallet-unlock';
import { connectWallet, walletAccount, type WalletBalances } from '../../wallet';
import { useRun, useStatus } from '../../hooks';
import type { Session } from '../../types';
import { Button } from '../ui';
export function BalanceAccess({ session, balances, available, loading, refresh }: {
  session: Session; balances?: WalletBalances; available: boolean; loading: boolean; refresh: () => Promise<unknown>;
}) {
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  const run = useRun(), status = useStatus();
  const builtIn = state !== 'absent' && localStorage.getItem('citrus:wallet-mode') !== 'metamask';
  const locked = builtIn && state === 'locked';
  if (!locked && (available || loading)) return null;
  const connect = !builtIn && !balances?.address && !balances?.unavailable;
  const switchNetwork = !builtIn && !!balances?.address && !balances.onNetwork;
  const title = locked ? 'Unlock wallet' : connect ? 'Connect MetaMask' : switchNetwork ? `Switch to ${session.network.name}` : 'Refresh balance';
  return <div className="mt-3 flex flex-wrap items-center gap-3">
    <Button className="!bg-raised !text-ink !px-4 !py-2 text-sm" disabled={loading && !locked} onClick={() => run(async () => {
      if (locked) { await requestUnlock(); status('Wallet unlocked.'); }
      else if (connect || switchNetwork) {
        const wallet = await connectWallet(session.network);
        await walletAccount(wallet, session.network, status);
        status('MetaMask connected.');
      }
      await refresh();
    })}>{title}</Button>
    {locked && <span className="text-xs text-white/80">Use your wallet password or device unlock.</span>}
  </div>;
}
