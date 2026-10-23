import * as SecureStore from 'expo-secure-store';
import { nativeBalanceAddress, nativeVaultState } from './local-wallet';
let externalAddress: string | null = null;
let mode = 'citrus';
export async function loadWalletPreference() {
  mode = await SecureStore.getItemAsync('citrus-wallet-mode') || 'citrus';
  externalAddress = await SecureStore.getItemAsync('citrus-metamask-address');
}
export function walletMode() { return nativeVaultState() === 'absent' ? 'metamask' : mode; }
export function configuredAddress() { return walletMode() === 'metamask' ? externalAddress : nativeBalanceAddress(); }
export async function selectWallet(value: 'citrus' | 'metamask') { await SecureStore.setItemAsync('citrus-wallet-mode', value); mode = value; }
export async function rememberExternalWallet(address: string) { await SecureStore.setItemAsync('citrus-metamask-address', address); externalAddress = address; }
