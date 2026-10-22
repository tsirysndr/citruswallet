import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startAnvil, waitForAnvil, RPC_URL } from './anvil.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const API_PORT = process.env.PORT ?? '4747';
const WEB_PORT = process.env.VITE_PORT ?? '5173';
// A loopback IP literal, not localhost: AT Protocol OAuth refuses a
// "localhost" redirect URI (RFC 8252).
const APP_URL = 'http://127.0.0.1:' + WEB_PORT;
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  // Do not leave the local chain or watch process behind if shutdown stalls.
  setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); }, 3000).unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function track(child) {
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
  return child;
}
try {
  // Refuse to reuse an existing node: its account seed or chain configuration may differ.
  const occupied = await fetch(RPC_URL, {signal: AbortSignal.timeout(500)}).then(() => true, () => false);
  if (occupied) throw new Error('Port 8545 is already in use. Stop the existing node before running dev:local.');
  const anvil = track(startAnvil());
  await waitForAnvil(anvil);
  if (!stopping) {
    // The browser talks to Vite, which proxies the API to the Gleam server, so
    // APP_URL is the Vite origin: that is the origin OAuth must return to.
    console.log('\nCitrus Wallet: ' + APP_URL + ' · Anvil RPC: ' + RPC_URL + '\n');
    track(spawn('gleam', ['run'], {
      cwd, stdio: 'inherit',
      env: { ...process.env, APP_URL, PORT: API_PORT, HOST: '127.0.0.1',
        EVM_CHAIN_ID: '31337', ETH_RPC_URL: RPC_URL, DATABASE_PATH: './data/local.sqlite' },
    }));
    track(spawn('bunx', ['vite'], {
      cwd, stdio: 'inherit',
      env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:' + API_PORT, VITE_PORT: WEB_PORT },
    }));
  }
} catch (error) { console.error(error.message); stop(1); }
