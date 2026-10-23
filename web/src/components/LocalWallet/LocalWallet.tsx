import { RecoveryBackup } from "../RecoveryBackup";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRecoveryPhrase, normalizeSecret, type WalletSecret } from '@citruswallet/wallet-core';
import { backupLocalWallet, localAddress, localWalletState, lockLocalWallet, saveLocalWallet, subscribeWallet, unlockLocalWallet } from '../../local-wallet';
import { enableWalletPasskey, hasWalletPasskey, supportsWalletPasskeys, unlockWithPasskey } from '../../wallet-passkey';
import { Button, Heading, Hint, Input, Label, Panel } from '../ui';

export function LocalWallet({ allowWhileBusy = false }: { allowWhileBusy?: boolean }) {
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  const [mode, setMode] = useState<'home' | 'create' | 'import' | 'backup'>('home');
  const [kind, setKind] = useState<WalletSecret['kind']>('mnemonic');
  const [phrase, setPhrase] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState(false);
  const clear = () => { setPhrase(''); setPassword(''); setRepeat(''); setConfirmed(false); setMode('home'); };
  useEffect(() => { void supportsWalletPasskeys().then(setPasskeys).catch(() => {}); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) clear(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const act = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  const save = () => act(async () => {
    if (password !== repeat) throw new Error('Your passwords do not match.');
    if (mode === 'create' && !confirmed) throw new Error('Choose the three missing recovery words to confirm your backup.');
    await saveLocalWallet(normalizeSecret(phrase, mode === 'create' ? 'mnemonic' : kind), password); clear();
  });
  return <Panel><Heading>Citrus wallet</Heading>
    <Hint className="mt-2">Your wallet, on this device. No extension needed. Only you control your keys.</Hint>
    {state === 'absent' && mode === 'home' && <div className="mt-4 flex flex-wrap gap-3">
      <Button keepEnabled={allowWhileBusy} onClick={() => { setPhrase(createRecoveryPhrase()); setMode('create'); }}>Create a wallet</Button>
      <Button keepEnabled={allowWhileBusy} variant="subtle" onClick={() => setMode('import')}>I already have a wallet</Button>
    </div>}
    {state === 'absent' && (mode === 'create' || mode === 'import') && <form className="mt-4 flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void save(); }}>
      {mode === 'create' ? <RecoveryBackup key={phrase} phrase={phrase} onConfirmed={setConfirmed} allowWhileBusy={allowWhileBusy} /> : <>
        <Label htmlFor="wallet-import-kind">Restore using</Label><select id="wallet-import-kind" value={kind} onChange={e => setKind(e.target.value as WalletSecret['kind'])}><option value="mnemonic">Recovery phrase</option><option value="privateKey">Private key</option></select>
        <Label htmlFor="wallet-secret">{kind === 'mnemonic' ? 'Recovery words, in order' : 'Private key'}</Label>
        <textarea id="wallet-secret" className="rounded-md bg-sunken p-3" value={phrase} onChange={e => setPhrase(e.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="none" />
        <Hint>Restores the first Ethereum account. Imported recovery phrases with an extra BIP-39 passphrase are not supported.</Hint>
      </>}
      {(mode === "import" || confirmed) && <>
      <Label htmlFor="wallet-new-password">Protect this wallet with a password</Label><Input id="wallet-new-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
      <Hint>At least 12 characters. This password unlocks this browser only.</Hint>
      <Label htmlFor="wallet-repeat">Repeat password</Label><Input id="wallet-repeat" type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} />
      <Button keepEnabled={allowWhileBusy} type="submit" disabled={busy}>Save my wallet</Button></>}<Button keepEnabled={allowWhileBusy} variant="subtle" disabled={busy} onClick={clear}>Cancel</Button>
    </form>}
    {state === 'locked' && <form className="mt-4 flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void act(async () => { await unlockLocalWallet(password); clear(); }); }}>
      <Label htmlFor="wallet-password">Wallet password</Label><Input id="wallet-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      <Button keepEnabled={allowWhileBusy} type="submit" disabled={busy}>Unlock wallet</Button>
      {hasWalletPasskey() && <Button keepEnabled={allowWhileBusy} variant="subtle" disabled={busy} onClick={() => act(unlockWithPasskey)}>Unlock with your device</Button>}
    </form>}
    {state === 'unlocked' && <div className="mt-4 flex flex-col gap-3">
      <p className="break-all font-mono text-sm">{localAddress()}</p>
      <Hint>Locks when you leave this tab or after 5 minutes without a wallet action.</Hint>
      <div className="flex flex-wrap gap-3"><Button keepEnabled={allowWhileBusy} variant="subtle" onClick={() => { clear(); lockLocalWallet(); }}>Lock wallet</Button><Button keepEnabled={allowWhileBusy} variant="subtle" onClick={() => setMode('backup')}>Backup & security</Button></div>
      {mode === 'backup' && <>
        <Label htmlFor="wallet-security-password">Confirm your password</Label><Input id="wallet-security-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        <Button keepEnabled={allowWhileBusy} disabled={busy} onClick={() => act(async () => { const value = await backupLocalWallet(password); setPhrase(value.value); setPassword(''); })}>Show my recovery information</Button>
        {passkeys && <Button keepEnabled={allowWhileBusy} disabled={busy} variant="subtle" onClick={() => act(async () => { await enableWalletPasskey(password); clear(); })}>Enable device unlock</Button>}
        {phrase && <p className="break-all rounded-md bg-sunken p-4 font-mono">{phrase}</p>}
        <Hint>Device unlock depends on your browser and authenticator. Keep your password and recovery backup.</Hint>
        <Button keepEnabled={allowWhileBusy} variant="subtle" onClick={clear}>Done</Button>
      </>}
    </div>}
    {busy && <Hint>Securing your wallet…</Hint>}{error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
  </Panel>;
}
