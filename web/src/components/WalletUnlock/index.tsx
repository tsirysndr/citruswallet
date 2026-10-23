import { useEffect, useRef, useSyncExternalStore } from 'react';
import { localWalletState, subscribeWallet, lockLocalWallet } from '../../local-wallet';
import { finishUnlock, subscribeUnlock, unlockSnapshot } from '../../wallet-unlock';
import { LocalWallet } from '../LocalWallet';
import { Button } from '../ui';
export function WalletUnlock() {
  const open = useSyncExternalStore(subscribeUnlock, unlockSnapshot);
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && state === 'unlocked') finishUnlock(true);
    else if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open, state]);
  return <dialog ref={dialog} aria-label="Unlock Citrus wallet" className="m-auto max-h-[90dvh] w-[min(94vw,480px)] rounded-2xl border border-edge bg-white p-4 text-ink backdrop:bg-black/25" onCancel={event => { event.preventDefault(); lockLocalWallet(); finishUnlock(false); }}>
    {open && <LocalWallet allowWhileBusy />}<Button keepEnabled variant="subtle" className="mt-3 w-full" onClick={() => { lockLocalWallet(); finishUnlock(false); }}>Cancel</Button>
  </dialog>;
}
