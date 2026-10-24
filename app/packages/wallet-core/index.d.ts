import type { PrivateKeyAccount, HDAccount } from "viem/accounts";
export type WalletSecret = { kind: "mnemonic" | "privateKey"; value: string };
export type VaultEnvelope = {
  version: 1;
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
};
export function randomBytes(length: number): Uint8Array;
export function createRecoveryPhrase(): string;
export function normalizeSecret(
  input: string,
  kind: WalletSecret["kind"],
): WalletSecret;
export function accountFromSecret(
  secret: WalletSecret,
): PrivateKeyAccount | HDAccount;
export function validatePassword(password: string): void;
export function encryptSecret(
  secret: WalletSecret,
  password: string,
): Promise<VaultEnvelope>;
export function decryptSecret(
  envelope: VaultEnvelope,
  password: string,
): Promise<WalletSecret>;
export function validateEnvelope(envelope: unknown): VaultEnvelope;
export type RecoveryPrompt = { index: number; choices: string[] };
export function recoveryChallenge(phrase: string): RecoveryPrompt[];
export type FeeTransaction = {
  from: string;
  to: string;
  value: string;
  data: string;
  nonce: string;
  chainId: string;
};
export type FeeQuote = {
  chainId: number;
  from: string;
  to: string;
  value: string;
  data: string;
  nonce: number;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  maxFeeWei: string;
  expiresAt: number;
};
export function feeQuoteParameters(
  quote: FeeQuote,
  transaction: FeeTransaction,
  chainId: number,
  now?: number,
): {
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  type: "eip1559";
};
export type CloudProvider = "google" | "dropbox";
export type CloudFile = { id: string; name: string; modifiedAt: string };
export const driveScope: string;
export function createCloudBackup(
  secret: WalletSecret,
  password: string,
): Promise<string>;
export function parseCloudBackup(text: string): {
  format: "app.peachlet.wallet-backup";
  version: 1;
  createdAt: string;
  envelope: VaultEnvelope;
};
export function restoreCloudBackup(
  text: string,
  password: string,
): Promise<WalletSecret>;
export type DropboxAuthorization = {
  url: string;
  verifier: string;
  state: string;
  redirectUri: string;
  clientId: string;
};
export function dropboxAuthorization(
  clientId: string,
  redirectUri: string,
): DropboxAuthorization;
export function exchangeDropboxCode(
  auth: DropboxAuthorization,
  callbackUrl: string,
): Promise<string>;
export function listCloudBackups(
  provider: CloudProvider,
  token: string,
): Promise<CloudFile[]>;
export function downloadCloudBackup(
  provider: CloudProvider,
  token: string,
  id: string,
): Promise<string>;
export function uploadCloudBackup(
  provider: CloudProvider,
  token: string,
  text: string,
): Promise<CloudFile>;
