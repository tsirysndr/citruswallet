import { requestUnlock } from "./wallet-unlock";
import { nativeProvider, nativeVaultState } from "./local-wallet";
import { expectedTransfer } from "@citruswallet/amounts";
import { Linking } from "react-native";
import { createEVMClient } from "@metamask/connect-evm";
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import { request } from "./api";
import type { Network, Payment, Attempt, Challenge } from "./types";
import { nativeWalletUI, withWalletDeadline } from "./wallet-connection";
let client: ReturnType<typeof createEVMClient> | undefined;
let launchFailed: ((error: Error) => void) | undefined;
export function getClient() {
  return (client ??= createEVMClient({
    dapp: {
      name: "Citrus Wallet",
      url: "https://citruswallet.app",
      iconUrl: "https://citruswallet.app/icons/icon-192.png",
    },
    api: {
      supportedNetworks: {
        "0x10e6": "https://mainnet.megaeth.com/rpc",
        "0x1": process.env.EXPO_PUBLIC_ETH_RPC_URL || "https://ethereum-rpc.publicnode.com",
      },
    },
    analytics: { enabled: false },
    ui: nativeWalletUI,
    mobile: {
      useDeeplink: true,
      preferredOpenLink: (link) => {
        // The SDK does not await this callback. Forward launch failures to the
        // active connection instead of leaving an unhandled rejection.
        void Linking.openURL(link).catch(() => {
          launchFailed?.(new Error("Could not open MetaMask. Install the MetaMask app, then try again."));
        });
      },
    },
    skipAutoAnnounce: true,
  }));
}
export async function connect(network: Network) {
  if (["locked", "unlocked"].includes(nativeVaultState()) && await SecureStore.getItemAsync("citrus-wallet-mode") !== "metamask") {
    if (nativeVaultState() === "locked") await requestUnlock();
    const wallet = nativeProvider(network);
    const addresses = await wallet.request({ method: "eth_requestAccounts" });
    return { wallet, address: addresses[0] as string };
  }
  const sdk = await withWalletDeadline(getClient(), 20_000,
    "MetaMask could not initialize. Close and reopen Citrus Wallet, then try again.");
  if (sdk.status !== "connected") {
    const launchError = new Promise<never>((_, reject) => { launchFailed = reject; });
    try {
      await withWalletDeadline(Promise.race([
        sdk.connect({ chainIds: [network.chainIdHex as `0x${string}`] }),
        launchError,
      ]), 60_000, "MetaMask connection timed out. Check your internet connection and try again. If MetaMask opened, finish connecting there first.");
    } finally {
      launchFailed = undefined;
    }
  }
  const wallet = sdk.getProvider();
  if ((await wallet.request({ method: "eth_chainId" })) !== network.chainIdHex) {
    try { await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: network.chainIdHex }] }); }
    catch (error: any) {
      if (error?.code !== 4902 || !network.rpcUrls?.length) throw error;
      await wallet.request({ method: "wallet_addEthereumChain", params: [{ chainId: network.chainIdHex, chainName: network.name, nativeCurrency: network.nativeCurrency, rpcUrls: network.rpcUrls }] });
      await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: network.chainIdHex }] });
    }
  }
  const addresses = (await wallet.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!addresses[0]) throw new Error("Select an account in MetaMask.");
  return { wallet, address: addresses[0] };
}
async function check(
  wallet: Awaited<ReturnType<typeof connect>>["wallet"],
  address: string,
  network: Network,
) {
  const accounts = (await wallet.request({
    method: "eth_accounts",
  })) as string[];
  if (
    accounts[0]?.toLowerCase() !== address.toLowerCase() ||
    (await wallet.request({ method: "eth_chainId" })) !== network.chainIdHex
  )
    throw new Error("Account or network changed. Review again.");
}
export async function linkWallet(network: Network, publicAddress: boolean) {
  const { wallet, address } = await connect(network);
  const challenge = await request<Challenge>("createChallenge", {
    address,
    public: publicAddress,
  });
  if (challenge.chainId !== network.chainId) throw new Error("Network changed. Review and try again.");
  await check(wallet, address, network);
  const signature = await wallet.request({
    method: "personal_sign",
    params: [
      "0x" + Buffer.from(challenge.message, "utf8").toString("hex"),
      address,
    ],
  });
  await check(wallet, address, network);
  await request("verifyChallenge", { id: challenge.id, signature });
  return address;
}
const pendingKey = (did: string) =>
  "citrus-broadcast-" + did.replace(/[^a-zA-Z0-9._-]/g, "_");
export type Pending = { id: string; attemptId: string; txHash?: string };
export async function pending(did: string): Promise<Pending | null> {
  const raw = await SecureStore.getItemAsync(pendingKey(did));
  return raw ? JSON.parse(raw) : null;
}
export async function recover(did: string, hash?: string) {
  const item = await pending(did);
  if (!item) return;
  const txHash = hash || item.txHash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || ""))
    throw new Error(
      "Check your wallet and paste the original transaction hash. Do not send again.",
    );
  await request("submitPayment", {
    id: item.id,
    attemptId: item.attemptId,
    txHash,
  });
  await SecureStore.deleteItemAsync(pendingKey(did));
}
export async function sendPayment(
  did: string,
  network: Network,
  payment: Payment,
) {
  if (await pending(did))
    throw new Error(
      "Recover the previous wallet request before sending again.",
    );
  if (!payment.address) throw new Error("Recipient has no receiving address.");
  const { wallet, address } = await connect(network);
  const attempt = await request<Attempt>("preparePayment", {
    id: payment.id,
    revision: payment.revision,
    address: payment.address,
    fromAddress: address,
  });
  const tx = attempt.transaction;
  const expected = expectedTransfer(payment);
  if (
    attempt.payment.recipientDid !== payment.recipientDid ||
    tx.to.toLowerCase() !== expected.to.toLowerCase() ||
    BigInt(tx.value) !== BigInt(expected.value) ||
    tx.chainId !== network.chainIdHex ||
    tx.from.toLowerCase() !== address.toLowerCase() ||
    tx.data.toLowerCase() !== expected.data.toLowerCase()
  )
    throw new Error("Payment changed. Review it again.");
  await check(wallet, address, network);
  const item: Pending = { id: payment.id, attemptId: attempt.attemptId };
  await SecureStore.setItemAsync(pendingKey(did), JSON.stringify(item));
  let hash: unknown;
  try {
    hash = await wallet.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
  } catch (error: any) {
    if (error?.code === 4001)
      await SecureStore.deleteItemAsync(pendingKey(did));
    throw error;
  }
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error("Check your wallet for the original transaction hash.");
  await SecureStore.setItemAsync(
    pendingKey(did),
    JSON.stringify({ ...item, txHash: hash }),
  );
  await recover(did);
}
