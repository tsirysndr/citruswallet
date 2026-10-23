import { requestUnlock } from "./wallet-unlock";
import { configureLocalNetwork, localProvider, localWalletState } from "./local-wallet";
import type { Network, Session } from "./types";
import { isMobileWalletBrowser, mobileWalletClient } from "./mobile-wallet";

let connectedMobileWallet: Eip1193Provider | null = null;

export type WalletBalances = {
  address: string | null;
  onNetwork: boolean;
  wei: Record<string, string>;
};

export const noBalances: WalletBalances = { address: null, onNetwork: false, wei: {} };

export function detectedMetaMask(): Eip1193Provider | null {
  const injected = window.ethereum;
  const wallet =
    injected?.providers?.find((candidate) => candidate.isMetaMask) ??
    (injected?.isMetaMask ? injected : null);
  return wallet;
}

export function provider(): Eip1193Provider {
  if (localWalletState() !== "absent" && localStorage.getItem("citrus:wallet-mode") !== "metamask") return localProvider;
  const wallet = detectedMetaMask() ?? connectedMobileWallet;
  if (!wallet)
    throw new Error(
      "Open this page in a browser with MetaMask installed, or in the MetaMask in-app browser.",
    );
  return wallet;
}

// Only explicit wallet actions may open the MetaMask app. Balance reads never connect.
export async function connectWallet(network: Network): Promise<Eip1193Provider> {
  configureLocalNetwork(network);
  if (localWalletState() !== "absent" && localStorage.getItem("citrus:wallet-mode") !== "metamask") {
    if (localWalletState() === "locked") await requestUnlock();
    return localProvider;
  }
  const injected = detectedMetaMask();
  if (injected) return injected;
  if (!isMobileWalletBrowser()) return provider();
  const client = await mobileWalletClient();
  if (client.status !== "connected") {
    const connectingProvider = client.getProvider();
    const showRequest = (uri: string) => window.dispatchEvent(
      new CustomEvent("citrus:metamask-request", { detail: uri }),
    );
    connectingProvider.on("display_uri", showRequest);
    try {
      await client.connect({ chainIds: [network.chainIdHex as `0x${string}`] });
    } finally {
      connectingProvider.removeListener("display_uri", showRequest);
      window.dispatchEvent(new CustomEvent("citrus:metamask-request", { detail: null }));
    }
  }
  const wallet = client.getProvider();
  if (connectedMobileWallet !== wallet) {
    connectedMobileWallet = wallet;
    wallet.once("disconnect", () => {
      connectedMobileWallet = null;
      window.dispatchEvent(new Event("citrus:wallet-connected"));
    });
  }
  window.dispatchEvent(new Event("citrus:wallet-connected"));
  return connectedMobileWallet;
}

export async function walletAccount(wallet: Eip1193Provider, network: Network) {
  const accounts: string[] = await wallet.request({ method: "eth_requestAccounts" });
  const address = accounts[0];
  if (!address) throw new Error("No Ethereum account selected.");
  if ((await wallet.request({ method: "eth_chainId" })) !== network.chainIdHex) {
    try {
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: network.chainIdHex }],
      });
    } catch (error: any) {
      if (
        (error.code !== 4902 && error.data?.originalError?.code !== 4902) ||
        !network.rpcUrls
      )
        throw error;
      await wallet.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: network.chainIdHex,
            chainName: network.name,
            rpcUrls: network.rpcUrls,
            nativeCurrency: network.nativeCurrency,
          },
        ],
      });
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: network.chainIdHex }],
      });
    }
  }
  return address;
}

export async function checkWallet(
  wallet: Eip1193Provider,
  address: string,
  network: Network,
) {
  const accounts: string[] = await wallet.request({ method: "eth_accounts" });
  if (
    accounts[0]?.toLowerCase() !== address.toLowerCase() ||
    (await wallet.request({ method: "eth_chainId" })) !== network.chainIdHex
  )
    throw new Error("Account or network changed. Review and try again.");
}

/* Balances are read through the wallet's own provider, so they need no server RPC. */
export async function readBalances(session: Session): Promise<WalletBalances> {
  if (!session.did) return noBalances;
  configureLocalNetwork(session.network);
  let wallet: Eip1193Provider;
  try {
    wallet = provider();
  } catch {
    return noBalances;
  }
  try {
    const onNetwork =
      (await wallet.request({ method: "eth_chainId" })) === session.network.chainIdHex;
    const accounts: string[] = await wallet.request({ method: "eth_accounts" });
    const address = accounts[0] ?? null;
    if (!onNetwork) return { address, onNetwork, wei: {} };
    const wanted = new Set(
      session.links
        .filter((link) => link.chain_id === session.network.chainId)
        .map((link) => link.address),
    );
    if (address) wanted.add(address);
    const wei: Record<string, string> = {};
    await Promise.all(
      [...wanted].map(async (each) => {
        wei[each.toLowerCase()] = await wallet.request({
          method: "eth_getBalance",
          params: [each, "latest"],
        });
      }),
    );
    return { address, onNetwork, wei };
  } catch {
    /* A wallet that refuses the read simply leaves balances unknown. */
    return noBalances;
  }
}
