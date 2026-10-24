import { requestUnlock } from "./wallet-unlock";
import {
  configureLocalNetwork,
  localProvider,
  localWalletState,
  localBalanceAddress,
} from "./local-wallet";
import type { Network, Session } from "./types";
import { isMobileWalletBrowser, mobileWalletClient } from "./mobile-wallet";

let connectedMobileWallet: Eip1193Provider | null = null;

export type WalletBalances = {
  address: string | null;
  onNetwork: boolean;
  unavailable?: boolean;
  wei: Record<string, string>;
};

export const noBalances: WalletBalances = {
  address: null,
  onNetwork: false,
  wei: {},
};

export function detectedMetaMask(): Eip1193Provider | null {
  const injected = window.ethereum;
  const wallet =
    injected?.providers?.find((candidate) => candidate.isMetaMask) ??
    (injected?.isMetaMask ? injected : null);
  return wallet;
}

export function provider(): Eip1193Provider {
  if (
    localWalletState() !== "absent" &&
    localStorage.getItem("citrus:wallet-mode") !== "metamask"
  )
    return localProvider;
  const wallet = detectedMetaMask() ?? connectedMobileWallet;
  if (!wallet)
    throw new Error(
      "Open this page in a browser with MetaMask installed, or in the MetaMask in-app browser.",
    );
  return wallet;
}

// Only explicit wallet actions may open the MetaMask app. Balance reads never connect.
export async function connectWallet(
  network: Network,
): Promise<Eip1193Provider> {
  configureLocalNetwork(network);
  if (
    localWalletState() !== "absent" &&
    localStorage.getItem("citrus:wallet-mode") !== "metamask"
  ) {
    if (localWalletState() === "locked") await requestUnlock();
    return localProvider;
  }
  const injected = detectedMetaMask();
  if (injected) return injected;
  if (!isMobileWalletBrowser()) return provider();
  const client = await mobileWalletClient();
  if (client.status !== "connected") {
    const connectingProvider = client.getProvider();
    const showRequest = (uri: string) =>
      window.dispatchEvent(
        new CustomEvent("citrus:metamask-request", { detail: uri }),
      );
    connectingProvider.on("display_uri", showRequest);
    try {
      await client.connect({ chainIds: [network.chainIdHex as `0x${string}`] });
    } finally {
      connectingProvider.removeListener("display_uri", showRequest);
      window.dispatchEvent(
        new CustomEvent("citrus:metamask-request", { detail: null }),
      );
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

const accountRequests = new WeakMap<
  Eip1193Provider,
  { chain: string; promise: Promise<string> }
>();
function walletErrorCode(error: any) {
  return error?.data?.originalError?.code ?? error?.rpcCode ?? error?.code;
}
const pendingNetworkMessage =
  "Open MetaMask and finish the pending network request. Select the requested network there, then return to Peachlet.";

// Joining the same operation prevents duplicate permission/network prompts even
// when multiple callers share a provider. Never retry add-chain automatically.
export function walletAccount(
  wallet: Eip1193Provider,
  network: Network,
  status?: (message: string) => void,
): Promise<string> {
  const pending = accountRequests.get(wallet);
  if (pending)
    return pending.chain === network.chainIdHex
      ? pending.promise
      : Promise.reject(
          new Error(
            "Finish the current wallet connection before changing networks.",
          ),
        );
  const promise = prepareAccount(wallet, network, status).finally(() => {
    if (accountRequests.get(wallet)?.promise === promise)
      accountRequests.delete(wallet);
  });
  accountRequests.set(wallet, { chain: network.chainIdHex, promise });
  return promise;
}
async function prepareAccount(
  wallet: Eip1193Provider,
  network: Network,
  status?: (message: string) => void,
) {
  let accounts: string[];
  try {
    accounts = await wallet.request({ method: "eth_requestAccounts" });
  } catch (error) {
    if (walletErrorCode(error) !== -32002) throw error;
    // A network prompt can also block requestAccounts for an already-authorized account.
    accounts = await wallet.request({ method: "eth_accounts" });
    if (!accounts.length)
      throw new Error(
        "Open MetaMask and finish the pending request, then try linking again.",
      );
  }
  const address = accounts[0];
  if (!address) throw new Error("No Ethereum account selected.");
  const onNetwork = async () =>
    (await wallet.request({ method: "eth_chainId" })).toLowerCase() ===
    network.chainIdHex.toLowerCase();
  if (!(await onNetwork())) {
    status?.(`Open MetaMask to connect to ${network.name}.`);
    try {
      try {
        await wallet.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: network.chainIdHex }],
        });
      } catch (error) {
        if (walletErrorCode(error) !== 4902 || !network.rpcUrls?.length)
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
        // MetaMask may already switch on approval. Do not open a redundant prompt.
        if (!(await onNetwork()))
          await wallet.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: network.chainIdHex }],
          });
      }
    } catch (error) {
      if (walletErrorCode(error) !== -32002) throw error;
      status?.(`${pendingNetworkMessage} Waiting for ${network.name}…`);
      const deadline = Date.now() + 30_000;
      while (!(await onNetwork())) {
        if (Date.now() >= deadline)
          throw new Error(`${pendingNetworkMessage} Then try linking again.`);
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }
  }
  await checkWallet(wallet, address, network);
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
      (await wallet.request({ method: "eth_chainId" })) ===
      session.network.chainIdHex;
    const accounts: string[] = await wallet.request({ method: "eth_accounts" });
    const address = accounts[0] ?? localBalanceAddress();
    if (!onNetwork) return { address, onNetwork, wei: {} };
    const wanted = new Set(
      session.links
        .filter((link) => link.chain_id === session.network.chainId)
        .map((link) => link.address),
    );
    if (address) wanted.add(address);
    const local = localBalanceAddress();
    if (local) wanted.add(local);
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
    /* A failed read must not become an empty-account zero. */
    return { ...noBalances, unavailable: true };
  }
}
