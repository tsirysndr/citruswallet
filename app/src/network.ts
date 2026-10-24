import * as SecureStore from "expo-secure-store";
import type { Network } from "./types";
let chain: string | null = null;
let customRpc = "";
export function selectedChain() {
  return chain;
}
export function currentRpc() {
  return customRpc;
}
export async function loadNetwork() {
  chain = await SecureStore.getItemAsync("citrus-network");
  customRpc = chain
    ? (await SecureStore.getItemAsync(`citrus-rpc-${chain}`)) || ""
    : "";
}
export function deviceNetwork(network: Network): Network {
  return String(network.chainId) === chain && customRpc
    ? { ...network, rpcUrls: [customRpc] }
    : network;
}
export async function saveNetwork(id: string, raw: string) {
  if (!["1", "4326", "6343"].includes(id))
    throw new Error("Unsupported network.");
  const value = raw.trim();
  if (value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new Error(
        "Use an HTTPS RPC URL without a username, password or fragment.",
      );
    const response = await fetch(url.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    if (!response.ok || data.result !== `0x${Number(id).toString(16)}`)
      throw new Error("RPC network mismatch.");
    await SecureStore.setItemAsync(`citrus-rpc-${id}`, url.href);
  } else await SecureStore.deleteItemAsync(`citrus-rpc-${id}`);
  await SecureStore.setItemAsync("citrus-network", id);
  await loadNetwork();
}
