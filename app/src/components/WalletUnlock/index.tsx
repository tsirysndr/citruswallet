import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Modal, ScrollView, View } from 'react-native';
import { useAtomValue } from 'jotai';
import { readyAtom } from '../../state';
import { walletMode } from '../../wallet-preferences';
import { lockNativeWallet, nativeVaultState as localWalletState, nativeProtection, subscribeNativeVault as subscribeWallet, unlockNativeVault } from '../../local-wallet';
import { finishUnlock, requestUnlock, subscribeUnlock, unlockSnapshot } from '../../wallet-unlock';
import { LocalWallet } from '../LocalWallet';
import { Text } from '../Typography';
export function WalletUnlock() {
  const open = useSyncExternalStore(subscribeUnlock, unlockSnapshot);
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  const ready = useAtomValue(readyAtom);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [error, setError] = useState('');
  const prompted = useRef(false), deviceAttempted = useRef(false);
  useEffect(() => { const sub = AppState.addEventListener('change', next => { if (next !== 'active') prompted.current = false; setActive(next === 'active'); }); return () => sub.remove(); }, []);
  useEffect(() => {
    if (state !== 'locked') { prompted.current = false; return; }
    if (!ready || !active || walletMode() === 'metamask') return;
    if (open) { prompted.current = true; return; }
    if (prompted.current) return;
    prompted.current = true;
    void requestUnlock().catch(() => {});
  }, [state, open, ready, active]);
  useEffect(() => { if (open && state === 'unlocked') finishUnlock(true); }, [open, state]);
  useEffect(() => {
    if (!open) { deviceAttempted.current = false; setError(''); return; }
    if (!active || state !== 'locked' || nativeProtection() !== 'device' || deviceAttempted.current) return;
    deviceAttempted.current = true;
    void unlockNativeVault('').catch(() => setError('Device unlock was not completed. Try again or cancel.'));
  }, [open, state, active]);
  const cancel = () => { lockNativeWallet(); finishUnlock(false); };
  return <Modal visible={open} transparent animationType="slide" onRequestClose={cancel}>
    <View className="flex-1 justify-center bg-black/25 px-4 py-12"><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <View className="rounded-3xl bg-white p-5">{open && <LocalWallet allowWhileBusy onDismiss={cancel} />}{!!error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}</View>
    </ScrollView></View>
  </Modal>;
}
