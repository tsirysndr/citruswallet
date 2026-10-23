import { decryptSecret, encryptSecret, randomBytes, type VaultEnvelope } from '@citruswallet/wallet-core';
import { backupLocalWallet, encryptedLocalWallet, saveUnlockedSecret } from './local-wallet';
const key = 'citrus:wallet-passkey:v1';
const encode = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const decode = (hex: string) => Uint8Array.from(hex.match(/../g) || [], b => parseInt(b, 16));
const salt = new TextEncoder().encode('citruswallet:local-vault:prf:v1');
type PrfResult = { prf?: { enabled?: boolean; results?: { first: ArrayBuffer } } };
export function hasWalletPasskey() { return Boolean(localStorage.getItem(key)); }
export async function supportsWalletPasskeys() {
  return Boolean(window.isSecureContext && window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
}
async function evaluate(id: Uint8Array): Promise<string> {
  const credential = await navigator.credentials.get({ publicKey: {
    challenge: randomBytes(32) as Uint8Array<ArrayBuffer>,
    allowCredentials: [{ id: id as Uint8Array<ArrayBuffer>, type: 'public-key' }],
    userVerification: 'required',
    extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
  } }) as PublicKeyCredential | null;
  const result = (credential?.getClientExtensionResults() as PrfResult)?.prf?.results?.first;
  if (!result) throw new Error('This browser or authenticator cannot unlock wallet storage. Use your password.');
  const bytes = new Uint8Array(result);
  try { return encode(bytes); } finally { bytes.fill(0); }
}
export async function enableWalletPasskey(password: string) {
  const secret = await backupLocalWallet(password);
  const credential = await navigator.credentials.create({ publicKey: {
    challenge: randomBytes(32) as Uint8Array<ArrayBuffer>,
    rp: { name: 'Citrus Wallet' },
    user: { id: randomBytes(32) as Uint8Array<ArrayBuffer>, name: 'Citrus wallet', displayName: 'Unlock Citrus Wallet' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  } }) as PublicKeyCredential | null;
  if (!credential || !(credential.getClientExtensionResults() as PrfResult).prf?.enabled)
    throw new Error('Secure wallet unlock is unavailable here. Your password still works.');
  const id = new Uint8Array(credential.rawId);
  const wrappingKey = await evaluate(id);
  const envelope = await encryptSecret(secret, wrappingKey);
  localStorage.setItem(key, JSON.stringify({ id: encode(id), envelope, vaultCiphertext: encryptedLocalWallet().ciphertext }));
}
export async function unlockWithPasskey() {
  const entry = JSON.parse(localStorage.getItem(key) || 'null') as { id: string; envelope: VaultEnvelope; vaultCiphertext: string } | null;
  if (!entry || !/^[0-9a-f]{2,4096}$/.test(entry.id)) throw new Error('No wallet passkey is configured.');
  if (entry.vaultCiphertext !== encryptedLocalWallet().ciphertext) throw new Error("Device unlock belongs to a different vault. Use your password.");
  const secret = await decryptSecret(entry.envelope, await evaluate(decode(entry.id)));
  if (document.hidden) throw new Error("Return to Citrus Wallet to unlock.");
  saveUnlockedSecret(secret);
}
