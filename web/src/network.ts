import type { Network } from './types';
export function selectedChain(): string | null {
  const params = new URLSearchParams(window.location.search);
  const chain = params.get('chainId');
  if (params.has('notificationPayment') && chain && ['1', '4326', '6343'].includes(chain)) localStorage.setItem('citrus:chain', chain);
  return localStorage.getItem('citrus:chain');
}
export function deviceNetwork(network: Network): Network {
  const custom = localStorage.getItem(`citrus:rpc:${network.chainId}`);
  return custom ? { ...network, rpcUrls: [custom] } : network;
}
export async function validateRpc(raw: string, chainId: number) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Use an HTTPS RPC URL without a username, password or fragment.');
  const response = await fetch(url.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(10_000), credentials: 'omit', redirect: 'error' });
  const result = await response.json();
  if (!response.ok || result.result !== `0x${chainId.toString(16)}`) throw new Error('This RPC does not match the selected network.');
  return url.href;
}
