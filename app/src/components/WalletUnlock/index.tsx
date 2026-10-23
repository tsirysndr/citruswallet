import { useEffect, useSyncExternalStore } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { lockNativeWallet, nativeVaultState as localWalletState, subscribeNativeVault as subscribeWallet } from '../../local-wallet';
import { finishUnlock, subscribeUnlock, unlockSnapshot } from '../../wallet-unlock';
import { LocalWallet } from '../LocalWallet';
import { Button } from '../ui';
export function WalletUnlock() {
  const open = useSyncExternalStore(subscribeUnlock, unlockSnapshot);
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  useEffect(() => { if (open && state === 'unlocked') finishUnlock(true); }, [open, state]);
  return <Modal visible={open} transparent animationType="slide" onRequestClose={() => { lockNativeWallet(); finishUnlock(false); }}>
    <View className="flex-1 justify-center bg-black/25 px-4 py-12"><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <View className="rounded-3xl bg-white p-4">{open && <LocalWallet allowWhileBusy />}<Button keepEnabled title="Cancel" tone="plain" onPress={() => { lockNativeWallet(); finishUnlock(false); }} /></View>
    </ScrollView></View>
  </Modal>;
}
