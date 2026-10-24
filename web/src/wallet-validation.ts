import { z } from 'zod';
import { normalizeSecret } from '@peachlet/wallet-core';
export const rpcUrl = z.string().trim().max(2048, 'RPC URL is too long.').refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash; } catch { return false; }
}, 'Use an HTTPS RPC URL without a username, password, or fragment.');
export const networkForm = (local: boolean) => z.object({ chain: z.enum(local ? ['4326', '6343', '1', '31337'] : ['4326', '6343', '1']), rpc: rpcUrl });
export const walletDefaults = { phrase: '', kind: 'mnemonic' as 'mnemonic' | 'privateKey', password: '', repeat: '' };
export function walletForm(creating: boolean) {
  return z.object({ phrase: z.string(), kind: z.enum(['mnemonic', 'privateKey']), password: z.string(), repeat: z.string() }).superRefine((value, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (creating) {
      try { normalizeSecret(value.phrase, value.kind); } catch { issue('phrase', value.kind === 'mnemonic' ? 'Enter a valid recovery phrase.' : 'Enter a valid private key.'); }
      if (value.password.length < 12) issue('password', 'Use at least 12 characters.');
      if (value.password !== value.repeat) issue('repeat', 'Passwords do not match.');
    } else if (!value.password) issue('password', 'Enter your wallet password.');
  });
}
