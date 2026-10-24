import { z } from 'zod';
import { normalizeSecret } from '@peachlet/wallet-core';
export const signInForm = z.object({ identifier: z.string().trim().transform(value => value.replace(/^@+/, ''))
  .refine(value => /^(did:(plc|web):\S+|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i.test(value) && value.length <= 253, 'Enter a handle like alice.bsky.social.') });
export const rpcUrl = z.string().trim().max(2048, 'RPC URL is too long.').refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash; } catch { return false; }
}, 'Use an HTTPS RPC URL without a username, password, or fragment.');
export const networkForm = z.object({ chain: z.enum(['4326', '6343', '1']), rpc: rpcUrl });
export const walletDefaults = { secret: '', kind: 'mnemonic' as 'mnemonic' | 'privateKey', password: '', repeat: '', credential: '', protection: 'device' as 'device' | 'password' };
export function walletForm(action: 'save' | 'unlock' | 'upgrade', current: string) {
  return z.object({ secret: z.string(), kind: z.enum(['mnemonic', 'privateKey']), password: z.string(), repeat: z.string(), credential: z.string(), protection: z.enum(['device', 'password']) }).superRefine((value, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (action === 'save') { try { normalizeSecret(value.secret, value.kind); } catch { issue('secret', value.kind === 'mnemonic' ? 'Enter a valid recovery phrase.' : 'Enter a valid private key.'); } }
    if (action !== 'unlock' && value.protection === 'password') {
      if (value.password.length < 12) issue('password', 'Use at least 12 characters.');
      if (value.password !== value.repeat) issue('repeat', 'Passwords do not match.');
    }
    if (action !== 'save' && current !== 'device') {
      if (current === 'legacy-pin' ? !/^\d{6,12}$/.test(value.credential) : !value.credential) issue('credential', current === 'legacy-pin' ? 'Enter your previous Peachlet PIN.' : 'Enter your wallet password.');
    }
  });
}
