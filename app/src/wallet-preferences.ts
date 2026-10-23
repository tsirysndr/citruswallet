import * as SecureStore from 'expo-secure-store';
import { nativeBalanceAddress } from './local-wallet';
export type WalletMode = 'citrus' | 'metamask';
let externalAddress: string | null = null;
let mode: WalletMode = 'citrus';
export async function loadWalletPreference() {
  const [savedMode, savedAddress] = await Promise.all([
    SecureStore.getItemAsync('citrus-wallet-mode'),
    SecureStore.getItemAsync('citrus-metamask-address'),
  ]);
  mode = savedMode === 'metamask' ? 'metamask' : 'citrus';
  externalAddress = savedAddress;
}
// Selection is independent of vault availability, loading, and lock state.
export function walletMode() { return mode; }
export function configuredAddress() { return walletMode() === 'metamask' ? externalAddress : nativeBalanceAddress(); }
export async function selectWallet(value: 'citrus' | 'metamask') { await SecureStore.setItemAsync('citrus-wallet-mode', value); mode = value; }
export async function rememberExternalWallet(address: string) { await SecureStore.setItemAsync('citrus-metamask-address', address); externalAddress = address; }
