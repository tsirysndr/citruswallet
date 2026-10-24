import { feeQuoteParameters } from '@peachlet/wallet-core';
import { estimateFees } from './fee-quote';
import { answerApproval, requestApproval } from "./wallet-approval";
import { deviceNetwork } from "./network";
import { accountFromSecret, normalizeSecret, decryptSecret, encryptSecret, validateEnvelope, validatePassword, type WalletSecret, type VaultEnvelope } from '@peachlet/wallet-core';
import { createPublicClient, createWalletClient, defineChain, http, formatEther, type Hex } from 'viem';
import type { Network } from './types';

const storageKey = 'citrus:encrypted-wallet:v1';
const addressKey = 'citrus:wallet-public-address:v1';
export function localBalanceAddress() {
  if (!localStorage.getItem(storageKey)) return null;
  const address = localStorage.getItem(addressKey);
  return address && /^0x[0-9a-f]{40}$/i.test(address) ? address : null;
}
function rememberAddress(value: WalletSecret) {
  // Public read-only metadata; signing always derives its address from the key.
  try { localStorage.setItem(addressKey, accountFromSecret(value).address); } catch { /* Balance cache is optional. */ }
}
let secret: WalletSecret | null = null;
let epoch = 0;
let timeout: ReturnType<typeof setTimeout> | undefined;
let configuredNetwork: Network | null = null;
const listeners = new Set<() => void>();
function changed() { for (const listener of listeners) listener(); window.dispatchEvent(new Event('citrus:wallet-connected')); }
export function subscribeWallet(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function localWalletState() { return secret ? 'unlocked' : localStorage.getItem(storageKey) ? 'locked' : 'absent'; }
export function lockLocalWallet() { answerApproval(false); epoch++; secret = null; clearTimeout(timeout); changed(); }
function touch() { clearTimeout(timeout); timeout = setTimeout(lockLocalWallet, 15 * 60_000); }
export function configureLocalNetwork(network: Network) { configuredNetwork = deviceNetwork(network); }
export async function saveLocalWallet(value: WalletSecret, password: string) {
  if (localWalletState() !== 'absent') throw new Error('A wallet already exists on this device.');
  validatePassword(password);
  const generation = epoch;
  const normalized = normalizeSecret(value.value, value.kind);
  const envelope = await encryptSecret(normalized, password);
  if (generation !== epoch || localWalletState() !== 'absent') throw new Error('Wallet setup was interrupted. Try again.');
  localStorage.removeItem("citrus:wallet-passkey:v1");
  localStorage.setItem(storageKey, JSON.stringify(envelope));
  rememberAddress(normalized);
  secret = normalized; touch(); changed();
}
export async function unlockLocalWallet(password: string) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) throw new Error('Create or restore a wallet first.');
  const generation = epoch;
  const value = await decryptSecret(validateEnvelope(JSON.parse(raw)), password);
  if (generation !== epoch || raw !== localStorage.getItem(storageKey)) throw new Error('Unlock was interrupted. Try again.');
  rememberAddress(value);
  secret = value; touch(); changed();
}
export function saveUnlockedSecret(value: WalletSecret) { rememberAddress(value); secret = value; touch(); changed(); }
export function localAddress() { return secret ? accountFromSecret(secret).address : null; }
export async function backupLocalWallet(password: string) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) throw new Error('No wallet found.');
  const generation = epoch;
  const value = await decryptSecret(validateEnvelope(JSON.parse(raw)), password);
  if (generation !== epoch || document.hidden) throw new Error("Backup access was interrupted.");
  return value;
}
export function encryptedLocalWallet(): VaultEnvelope {
  return validateEnvelope(JSON.parse(localStorage.getItem(storageKey) || 'null'));
}

// Only the reviewed Peachlet flows call this adapter. There is no injected provider
// exposed to third-party sites and no generic arbitrary-RPC signing endpoint.
export const localProvider: Eip1193Provider = {
  async request({ method, params }: { method: string; params?: any[] }) {
    const network = configuredNetwork;
    if (!network) throw new Error('Choose a network first.');
    if (method === 'eth_chainId') return network.chainIdHex;
    if (method === 'eth_accounts') return localAddress() ? [localAddress()] : [];
    if (method === 'eth_getBalance') {
      const url = network.rpcUrls?.[0] || (network.chainId === 1 ? 'https://ethereum-rpc.publicnode.com' : '');
      if (!url) throw new Error('No RPC configured.');
      const reader = createPublicClient({ transport: http(url) });
      if (await reader.getChainId() !== network.chainId) throw new Error('RPC network mismatch.');
      return `0x${(await reader.getBalance({ address: params![0] })).toString(16)}`;
    }
    if (!secret) throw new Error('Unlock your Peachlet wallet on the Wallet screen first.');
    const account = accountFromSecret(secret);
    const generation = epoch;
    touch();
    if (method === 'eth_requestAccounts') return [account.address];
    if (method === 'personal_sign') {
      if (params?.[1]?.toLowerCase() !== account.address.toLowerCase()) throw new Error('Wallet address changed.');
      return account.signMessage({ message: { raw: params![0] as Hex } });
    }
    const url = network.rpcUrls?.[0] || (network.chainId === 1 ? 'https://ethereum-rpc.publicnode.com' : '');
    if (!url) throw new Error('No RPC configured for this network.');
    const chain = defineChain({ id: network.chainId, name: network.name, nativeCurrency: network.nativeCurrency, rpcUrls: { default: { http: [url] } } });
    const publicClient = createPublicClient({ chain, transport: http(url) });
    if (await publicClient.getChainId() !== network.chainId) throw new Error('RPC returned a different network.');
    if (method !== 'eth_sendTransaction') throw new Error('Unsupported Peachlet wallet operation.');
    const tx = params?.[0];
    if (!tx || tx.from?.toLowerCase() !== account.address.toLowerCase() || tx.chainId !== network.chainIdHex) throw new Error('Transaction network or sender changed.');
    const client = createWalletClient({ account, chain, transport: http(url) });
    if (!/^0x[0-9a-f]+$/i.test(tx.nonce) || !Number.isSafeInteger(Number(BigInt(tx.nonce)))) throw new Error("Invalid transaction nonce.");
    const quote = await estimateFees(tx, network.chainId);
    const quotedFees = feeQuoteParameters(quote, tx, network.chainId);
    const prepared = await client.prepareTransactionRequest({ ...quotedFees, to: tx.to, value: BigInt(tx.value), nonce: Number(BigInt(tx.nonce)), data: tx.data, account });
    const fee = prepared.gas * (prepared.maxFeePerGas ?? prepared.gasPrice ?? 0n);
    // A separate confirmation follows simulation/fee estimation, before signing.
    if (!await requestApproval({ network: network.name, to: tx.to, value: formatEther(BigInt(tx.value)), fee: formatEther(fee), nonce: prepared.nonce, token: tx.data !== '0x' })) throw Object.assign(new Error('Payment cancelled.'), { code: 4001 });
    if (generation !== epoch || !secret || configuredNetwork?.chainId !== network.chainId) throw Object.assign(new Error('Wallet locked or network changed. Review again.'), { code: 4001 });
    feeQuoteParameters(quote, tx, network.chainId); // Recheck expiry after user approval.
    const serializedTransaction = await client.signTransaction(prepared);
    if (generation !== epoch || !secret || configuredNetwork?.chainId !== network.chainId) throw Object.assign(new Error("Wallet locked. Review again."), { code: 4001 });
    return client.sendRawTransaction({ serializedTransaction });
  },
};
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) lockLocalWallet(); });
  window.addEventListener('pagehide', lockLocalWallet);
  window.addEventListener('storage', (event) => { if (event.key === storageKey || event.key === 'citrus:chain' || event.key === 'citrus:wallet-mode' || event.key?.startsWith('citrus:rpc:')) lockLocalWallet(); });
}
