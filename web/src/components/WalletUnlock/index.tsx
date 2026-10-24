import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { localWalletState, subscribeWallet, lockLocalWallet } from '../../local-wallet';
import { finishUnlock, requestUnlock, subscribeUnlock, unlockSnapshot } from '../../wallet-unlock';
import { LocalWallet } from '../LocalWallet';
export function WalletUnlock() {
  const open = useSyncExternalStore(subscribeUnlock, unlockSnapshot);
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  const [visible, setVisible] = useState(() => !document.hidden);
  const prompted = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const changed = () => { if (document.hidden) prompted.current = false; setVisible(!document.hidden); };
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useEffect(() => {
    if (state !== 'locked') { prompted.current = false; return; }
    if (!visible || localStorage.getItem('citrus:wallet-mode') === 'metamask') return;
    if (open) { prompted.current = true; return; }
    if (prompted.current) return;
    prompted.current = true;
    // Cancellation leaves the wallet locked; the balance-card action can retry.
    void requestUnlock().catch(() => {});
  }, [state, open, visible]);
  useEffect(() => {
    if (open && state === 'unlocked') finishUnlock(true);
    else if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open, state]);
  return <dialog ref={dialog} aria-label="Unlock Citrus wallet" className="m-auto max-h-[90dvh] w-[min(94vw,480px)] rounded-2xl border border-edge bg-white p-4 text-ink backdrop:bg-black/25" onCancel={event => { event.preventDefault(); lockLocalWallet(); finishUnlock(false); }}>
    {open && <LocalWallet allowWhileBusy onDismiss={() => { lockLocalWallet(); finishUnlock(false); }} />}
  </dialog>;
}
