import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { entropyToMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

// Versioned, authenticated envelopes. Randomness must come from the platform's
// CSPRNG; callers cannot substitute Math.random or a deterministic fallback.
const iterations = 600_000;
const aad = utf8ToBytes('citruswallet:vault:1');
export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
export function createRecoveryPhrase() {
  const entropy = randomBytes(16);
  try { return entropyToMnemonic(entropy, wordlist); }
  finally { entropy.fill(0); }
}
export function normalizeSecret(input, kind) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Invalid wallet secret.');
  if (kind === 'mnemonic') {
    const value = input.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
    if (!validateMnemonic(value, wordlist)) throw new Error('Check your recovery words and their order.');
    return { kind, value };
  }
  if (kind !== 'privateKey') throw new Error('Unsupported wallet format.');
  const value = input.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(value)) throw new Error('Enter a valid 64-character private key.');
  const secret = { kind, value: `0x${value.toLowerCase()}` };
  accountFromSecret(secret); // Reject zero and scalars outside the curve order.
  return secret;
}
export function accountFromSecret(secret) {
  return secret.kind === 'mnemonic'
    ? mnemonicToAccount(secret.value, { path: "m/44'/60'/0'/0/0" })
    : privateKeyToAccount(secret.value);
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024)
    throw new Error('Use a password of at least 12 characters.');
}
async function derive(password, salt) {
  if (typeof password !== 'string' || password.length > 2048) throw new Error('Invalid unlock credential.');
  return pbkdf2Async(sha256, password, salt, { c: iterations, dkLen: 32, asyncTick: 10 });
}
export async function encryptSecret(secret, password) {
  const normalized = normalizeSecret(secret.value, secret.kind);
  const salt = randomBytes(32), nonce = randomBytes(12);
  const key = await derive(password, salt);
  const plaintext = utf8ToBytes(JSON.stringify(normalized));
  try {
    return { version: 1, kdf: 'pbkdf2-sha256', iterations,
      salt: bytesToHex(salt), nonce: bytesToHex(nonce),
      ciphertext: bytesToHex(gcm(key, nonce, aad).encrypt(plaintext)) };
  } finally { key.fill(0); plaintext.fill(0); }
}
export function validateEnvelope(envelope) {
  if (!envelope || envelope.version !== 1 || envelope.kdf !== 'pbkdf2-sha256' || envelope.iterations !== iterations ||
    !/^[a-f0-9]{64}$/.test(envelope.salt) || !/^[a-f0-9]{24}$/.test(envelope.nonce) ||
    typeof envelope.ciphertext !== 'string' || !/^[a-f0-9]{64,4096}$/.test(envelope.ciphertext) || envelope.ciphertext.length % 2)
    throw new Error('Wallet storage is invalid or unsupported. Restore from your backup.');
  return envelope;
}
export async function decryptSecret(envelope, password) {
  validateEnvelope(envelope);
  const key = await derive(password, hexToBytes(envelope.salt));
  let plaintext;
  try {
    plaintext = gcm(key, hexToBytes(envelope.nonce), aad).decrypt(hexToBytes(envelope.ciphertext));
    const parsed = JSON.parse(new TextDecoder().decode(plaintext));
    return normalizeSecret(parsed.value, parsed.kind);
  } catch { throw new Error('Unable to unlock. Check your password or PIN.'); }
  finally { key.fill(0); plaintext?.fill(0); }
}

function randomIndex(max) {
  const limit = 256 - (256 % max);
  let value;
  do { value = randomBytes(1)[0]; } while (value >= limit);
  return value % max;
}
function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// One missing word from each third of the phrase; repeated seed words are valid.
// Choices are unique even when the recovery phrase contains repeated words.
export function recoveryChallenge(phrase) {
  const words = normalizeSecret(phrase, 'mnemonic').value.split(' ');
  const size = words.length / 3;
  return [0, 1, 2].map(section => {
    const index = section * size + randomIndex(size);
    const choices = new Set([words[index]]);
    while (choices.size < 4) {
      const bytes = randomBytes(2);
      choices.add(wordlist[((bytes[0] << 8) | bytes[1]) % wordlist.length]);
    }
    return { index, choices: shuffled([...choices]) };
  });
}

// Bind a short-lived server fee quote to the exact transaction reviewed locally.
// Only fee fields are returned: a quote cannot replace the recipient or amount.
export function feeQuoteParameters(quote, transaction, chainId, now = Date.now()) {
  const integer = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) && value.length <= 156;
  if (!quote || quote.chainId !== chainId || transaction.chainId !== `0x${chainId.toString(16)}` ||
      quote.from?.toLowerCase() !== transaction.from?.toLowerCase() ||
      quote.to?.toLowerCase() !== transaction.to?.toLowerCase() ||
      quote.data?.toLowerCase() !== transaction.data?.toLowerCase() ||
      quote.value !== BigInt(transaction.value).toString() ||
      !Number.isSafeInteger(quote.nonce) || quote.nonce !== Number(BigInt(transaction.nonce)))
    throw new Error('Fee estimate does not match this transaction. Review again.');
  if (!Number.isSafeInteger(quote.expiresAt) || quote.expiresAt <= now || quote.expiresAt > now + 120_000)
    throw new Error('Fee estimate expired. Review the payment again.');
  if (![quote.gasLimit, quote.maxFeePerGas, quote.maxPriorityFeePerGas, quote.maxFeeWei].every(integer))
    throw new Error('Invalid network fee estimate.');
  const gas = BigInt(quote.gasLimit), maxFeePerGas = BigInt(quote.maxFeePerGas), maxPriorityFeePerGas = BigInt(quote.maxPriorityFeePerGas);
  if (gas <= 0n || maxFeePerGas < maxPriorityFeePerGas || gas * maxFeePerGas !== BigInt(quote.maxFeeWei))
    throw new Error('Invalid network fee estimate.');
  return { gas, maxFeePerGas, maxPriorityFeePerGas, type: 'eip1559' };
}
