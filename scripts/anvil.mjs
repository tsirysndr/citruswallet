import { spawn } from 'node:child_process';

export const RPC_URL = 'http://127.0.0.1:8545';
export const ANVIL_ARGS = ['--host', '127.0.0.1', '--port', '8545', '--chain-id', '31337'];
export function startAnvil() {
  const child = spawn('anvil', ANVIL_ARGS, { stdio: 'inherit' });
  child.on('error', error => console.error(`Could not start Anvil: ${error.message}. Run npm ci first, or install Foundry.`));
  return child;
}
export async function waitForAnvil(child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) throw new Error('Anvil exited before becoming ready.');
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: AbortSignal.timeout(500),
      });
      if ((await response.json()).result === '0x7a69') return;
    } catch { /* Retry until startup deadline. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Anvil did not become ready within 15 seconds.');
}
