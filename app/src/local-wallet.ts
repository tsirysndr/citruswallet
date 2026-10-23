import { deviceNetwork } from "./network";
import * as SecureStore from 'expo-secure-store';
import { AppState, Alert } from 'react-native';
import { accountFromSecret, decryptSecret, encryptSecret, normalizeSecret, randomBytes, type WalletSecret } from '@citruswallet/wallet-core';
import { createPublicClient, createWalletClient, defineChain, http, formatEther, type Hex } from 'viem';
import type { Network } from './types';
const vaultKey = 'citrus-vault-v1', pepperKey = 'citrus-vault-device-key-v1', biometricKey = 'citrus-vault-biometric-v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
let secret: WalletSecret | null = null, state = 'loading', generation = 0;
let balanceAddress: string | null = null;
const addressKey = 'citrus-vault-public-address-v1';
export function nativeBalanceAddress() { return balanceAddress; }
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
function emit() { for (const listener of listeners) listener(); }
function touch() { clearTimeout(timer); timer = setTimeout(lockNativeWallet, 300_000); }
export function nativeVaultState() { return state; }
export function subscribeNativeVault(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function lockNativeWallet() { generation++; secret = null; if (state === 'unlocked') state = 'locked'; clearTimeout(timer); emit(); }
export async function loadNativeVault() {
  state = await SecureStore.getItemAsync(vaultKey) ? 'locked' : 'absent';
  const stored = state === 'locked' ? await SecureStore.getItemAsync(addressKey) : null;
  balanceAddress = stored && /^0x[0-9a-f]{40}$/i.test(stored) ? stored : null;
  emit();
}
export function nativeAddress() { return secret ? accountFromSecret(secret).address : null; }
async function rememberAddress(value: WalletSecret) {
  balanceAddress = accountFromSecret(value).address;
  // Public, read-only metadata. Never use this cached address for signing.
  try { await SecureStore.setItemAsync(addressKey, balanceAddress, options); } catch { /* A balance cache failure must not prevent wallet recovery. */ }
}
function accept(value: WalletSecret) { secret = value; state = 'unlocked'; touch(); emit(); }
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export async function createNativeVault(value: WalletSecret, pin: string) {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('Choose a PIN with 6 to 12 digits.');
  if (state !== 'absent' || await SecureStore.getItemAsync(vaultKey)) throw new Error('A wallet already exists.');
  const ticket = generation;
  const pepper = hex(randomBytes(32));
  const normalized = normalizeSecret(value.value, value.kind);
  const envelope = await encryptSecret(normalized, `${pin}:${pepper}`);
  if (ticket !== generation) throw new Error('Setup interrupted. Try again.');
  await SecureStore.setItemAsync(pepperKey, pepper, options);
  await SecureStore.setItemAsync(vaultKey, JSON.stringify(envelope), options);
  await rememberAddress(normalized);
  if (ticket === generation) accept(normalized); else { state = 'locked'; emit(); }
}
export async function readNativeSecret(pin: string) {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('Enter your wallet PIN.');
  const ticket = generation;
  const attemptsKey = 'citrus-vault-attempts';
  const attempts = JSON.parse(await SecureStore.getItemAsync(attemptsKey) || '{"count":0,"next":0}');
  if (Date.now() < attempts.next) throw new Error('Wait a moment before trying your PIN again.');
  const count = Math.min(20, (Number(attempts.count) || 0) + 1);
  await SecureStore.setItemAsync(attemptsKey, JSON.stringify({ count, next: Date.now() + Math.min(300_000, 1000 * 2 ** count) }), options);
  const raw = await SecureStore.getItemAsync(vaultKey), pepper = await SecureStore.getItemAsync(pepperKey);
  if (!raw || !pepper) throw new Error('Wallet storage is unavailable. Restore your backup on a new installation.');
  let value: WalletSecret;
  try { value = await decryptSecret(JSON.parse(raw), `${pin}:${pepper}`); }
  catch (error) {
    await SecureStore.setItemAsync(attemptsKey, JSON.stringify({ count, next: Date.now() + Math.min(300_000, 1000 * 2 ** count) }), options);
    throw error;
  }
  if (ticket !== generation) throw new Error("Unlock interrupted. Try again.");
  await SecureStore.deleteItemAsync(attemptsKey);
  return value;
}
export async function unlockNativeVault(pin: string) {
  const ticket = generation;
  const value = await readNativeSecret(pin);
  await rememberAddress(value);
  if (ticket !== generation) throw new Error('Unlock interrupted. Try again.');
  accept(value);
}
export const canUseBiometrics = () => SecureStore.canUseBiometricAuthentication();
export async function enableNativeBiometrics(pin: string) {
  const value = await readNativeSecret(pin);
  // SecureStore gates the actual key material through the OS keystore; a UI-only
  // biometric boolean would not protect a wallet secret.
  await SecureStore.setItemAsync(biometricKey, JSON.stringify(value), { ...options, keychainService: "citrus-wallet-biometric-v1", requireAuthentication: true, authenticationPrompt: 'Protect Citrus Wallet' });
}
export async function unlockNativeBiometrics() {
  const raw = await SecureStore.getItemAsync(biometricKey, { ...options, keychainService: "citrus-wallet-biometric-v1", requireAuthentication: true, authenticationPrompt: 'Unlock Citrus Wallet' });
  if (!raw) throw new Error('Device unlock is unavailable or biometrics changed. Use your PIN.');
  if (AppState.currentState !== 'active') throw new Error('Return to Citrus to unlock.');
  const parsed = JSON.parse(raw);
  const value = normalizeSecret(parsed.value, parsed.kind);
  const ticket = generation;
  await rememberAddress(value);
  if (ticket !== generation || AppState.currentState !== 'active') throw new Error('Unlock interrupted.');
  accept(value);
}
AppState.addEventListener('change', state => { if (state !== 'active') lockNativeWallet(); });
function confirm(message: string) { return new Promise<boolean>(resolve => Alert.alert('Confirm payment', message, [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Send payment', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) })); }
export function nativeProvider(selected: Network) {
  const network = deviceNetwork(selected);
  return { async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
    if (method === 'eth_chainId') return network.chainIdHex;
    if (method === 'eth_accounts') return nativeAddress() ? [nativeAddress()] : [];
    if (!secret) throw new Error('Unlock Citrus Wallet from the Wallet screen first.');
    const account = accountFromSecret(secret), ticket = generation; touch();
    if (method === 'eth_requestAccounts') return [account.address];
    if (method === 'personal_sign') {
      if (params?.[1]?.toLowerCase() !== account.address.toLowerCase()) throw new Error('Wallet address changed.');
      return account.signMessage({ message: { raw: params![0] as Hex } });
    }
    if (method !== 'eth_sendTransaction') throw new Error('Unsupported wallet request.');
    const url = network.rpcUrls?.[0] || (network.chainId === 1 ? 'https://ethereum-rpc.publicnode.com' : '');
    if (!url) throw new Error('No RPC configured.');
    const chain = defineChain({ id: network.chainId, name: network.name, nativeCurrency: network.nativeCurrency, rpcUrls: { default: { http: [url] } } });
    const rpc = createPublicClient({ chain, transport: http(url) });
    if (await rpc.getChainId() !== network.chainId) throw new Error('RPC network mismatch.');
    const tx = params?.[0];
    if (!tx || tx.from?.toLowerCase() !== account.address.toLowerCase() || tx.chainId !== network.chainIdHex) throw new Error('Transaction network or sender changed.');
    const client = createWalletClient({ account, chain, transport: http(url) });
    if (!/^0x[0-9a-f]+$/i.test(tx.nonce) || !Number.isSafeInteger(Number(BigInt(tx.nonce)))) throw new Error("Invalid transaction nonce.");
    const prepared = await client.prepareTransactionRequest({ account, to: tx.to, value: BigInt(tx.value), nonce: Number(BigInt(tx.nonce)), data: tx.data });
    const fee = prepared.gas * (prepared.maxFeePerGas ?? prepared.gasPrice ?? 0n);
    if (!await confirm(`Network: ${network.name}\nTo: ${tx.to}\nMaximum network fee: ${formatEther(fee)} ETH`)) throw Object.assign(new Error('Cancelled.'), { code: 4001 });
    if (ticket !== generation || !secret) throw Object.assign(new Error('Wallet locked. Review again.'), { code: 4001 });
    const serializedTransaction = await client.signTransaction(prepared);
    if (ticket !== generation || !secret) throw Object.assign(new Error('Wallet locked. Review again.'), { code: 4001 });
    return client.sendRawTransaction({ serializedTransaction });
  } };
}
