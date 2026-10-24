import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { walletDefaults, walletForm } from '../../wallet-validation';
import { RecoveryBackup } from "../RecoveryBackup";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRecoveryPhrase, normalizeSecret, type WalletSecret } from '@citruswallet/wallet-core';
import { backupLocalWallet, localAddress, localWalletState, lockLocalWallet, saveLocalWallet, subscribeWallet, unlockLocalWallet } from '../../local-wallet';
import { enableWalletPasskey, hasWalletPasskey, supportsWalletPasskeys, unlockWithPasskey } from '../../wallet-passkey';
import { Button, Heading, Hint, Input, Label, Panel } from '../ui';

export function LocalWallet({ allowWhileBusy = false, initialAction, onCreated, onCancel, onDismiss }: { allowWhileBusy?: boolean; initialAction?: 'create' | 'import'; onCreated?: () => void; onCancel?: () => void; onDismiss?: () => void }) {
  const state = useSyncExternalStore(subscribeWallet, localWalletState);
  const [mode, setMode] = useState<'home' | 'create' | 'import' | 'backup'>(initialAction || 'home');
  const [initialPhrase] = useState(() => initialAction === 'create' ? createRecoveryPhrase() : '');
  const form = useForm({ resolver: zodResolver(walletForm(state === 'absent')), defaultValues: { ...walletDefaults, phrase: initialPhrase } });
  const kindField = useController({ control: form.control, name: 'kind' }).field;
  const phraseField = useController({ control: form.control, name: 'phrase' }).field;
  const passwordField = useController({ control: form.control, name: 'password' }).field;
  const repeatField = useController({ control: form.control, name: 'repeat' }).field;
  const { kind, phrase, password, repeat } = form.watch();
  const setKind = (value: WalletSecret['kind']) => kindField.onChange(value);
  const setPhrase = (value: string) => phraseField.onChange(value);
  const setPassword = (value: string) => passwordField.onChange(value);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState(false);
  const clear = () => { form.reset(walletDefaults); setConfirmed(false); setMode('home'); };
  useEffect(() => { void supportsWalletPasskeys().then(setPasskeys).catch(() => {}); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) { clear(); onCancel?.(); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const act = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  const validated = (action: () => Promise<void>) => { if (!busy) return form.handleSubmit(() => act(action))(); };
  const save = () => validated(async () => {
    if (password !== repeat) throw new Error('Your passwords do not match.');
    if (mode === 'create' && !confirmed) throw new Error('Choose the three missing recovery words to confirm your backup.');
    await saveLocalWallet(normalizeSecret(phrase, mode === 'create' ? 'mnemonic' : kind), password); clear(); onCreated?.();
  });
  return <Panel><Heading>{mode === "create" ? confirmed ? "Protect your wallet" : "Back up your wallet" : mode === "import" ? "Restore your wallet" : "Wallet security"}</Heading>
    <Hint className="mt-2">Your wallet, on this device. No extension needed. Only you control your keys.</Hint>
    {state === 'absent' && mode === 'home' && <div className="mt-4 flex flex-wrap gap-3">
      <Button keepEnabled={allowWhileBusy} onClick={() => { setPhrase(createRecoveryPhrase()); setMode('create'); }}>Create a wallet</Button>
      <Button keepEnabled={allowWhileBusy} variant="subtle" onClick={() => setMode('import')}>I already have a wallet</Button>
    </div>}
    {state === 'absent' && (mode === 'create' || mode === 'import') && <form noValidate className="mt-4 flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void save(); }}>
      {mode === 'create' ? !confirmed && <RecoveryBackup key={phrase} phrase={phrase} onConfirmed={setConfirmed} allowWhileBusy={allowWhileBusy} /> : <>
        <Label htmlFor="wallet-import-kind">Restore using</Label><select id="wallet-import-kind" value={kind} onChange={e => setKind(e.target.value as WalletSecret['kind'])}><option value="mnemonic">Recovery phrase</option><option value="privateKey">Private key</option></select>
        <Label htmlFor="wallet-secret">{kind === 'mnemonic' ? 'Recovery words, in order' : 'Private key'}</Label>
        <Input id="wallet-secret" type="password" secretLabel={kind === "mnemonic" ? "recovery words" : "private key"} {...phraseField} aria-invalid={!!form.formState.errors.phrase} autoComplete="off" spellCheck={false} autoCapitalize="none" />
        <Hint>Restores the first Ethereum account. Imported recovery phrases with an extra BIP-39 passphrase are not supported.</Hint>
      </>}
      {(mode === "import" || confirmed) && <>
      <Label htmlFor="wallet-new-password">Protect this wallet with a password</Label><Input id="wallet-new-password" type="password" autoComplete="new-password" {...passwordField} aria-invalid={!!form.formState.errors.password} />
      <Hint>At least 12 characters. This password unlocks this browser only.</Hint>
      <Label htmlFor="wallet-repeat">Repeat password</Label><Input id="wallet-repeat" type="password" autoComplete="new-password" {...repeatField} aria-invalid={!!form.formState.errors.repeat} />
      <Button keepEnabled={allowWhileBusy} type="submit" disabled={busy}>Save my wallet</Button>{mode === "create" && <Button variant="subtle" disabled={busy} onClick={() => setConfirmed(false)}>Back to recovery phrase</Button>}</>}<Button keepEnabled={allowWhileBusy} variant="subtle" disabled={busy} onClick={() => { clear(); onCancel?.(); }}>Cancel</Button>
    </form>}
    {state === 'locked' && <form noValidate className="mt-4 flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void validated(async () => { await unlockLocalWallet(password); clear(); }); }}>
      <Label htmlFor="wallet-password">Wallet password</Label><Input id="wallet-password" type="password" autoComplete="current-password" {...passwordField} aria-invalid={!!form.formState.errors.password} />
      <div className="mt-3 flex items-center justify-end gap-3">{onDismiss && <Button keepEnabled variant="subtle" onClick={onDismiss}>Cancel</Button>}<Button keepEnabled={allowWhileBusy} type="submit" disabled={busy}>Unlock wallet</Button></div>
      {hasWalletPasskey() && <Button keepEnabled={allowWhileBusy} variant="subtle" disabled={busy} onClick={() => act(unlockWithPasskey)}>Unlock with your device</Button>}
    </form>}
    {state === 'unlocked' && <div className="mt-4 flex flex-col gap-3">
      <p className="break-all font-mono text-sm">{localAddress()}</p>
      <Hint>Locks when you leave this tab or after 15 minutes without a wallet action.</Hint>
      <div className="flex flex-wrap gap-3"><Button keepEnabled={allowWhileBusy} variant="subtle" onClick={() => { clear(); lockLocalWallet(); }}>Lock wallet</Button><Button keepEnabled={allowWhileBusy} variant="subtle" onClick={() => setMode('backup')}>Backup & security</Button></div>
      {mode === 'backup' && <form noValidate className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); if (!busy) void validated(async () => { const value = await backupLocalWallet(password); setPhrase(value.value); setPassword(''); }); }}>
        <Label htmlFor="wallet-security-password">Confirm your password</Label><Input id="wallet-security-password" type="password" {...passwordField} aria-invalid={!!form.formState.errors.password} autoComplete="current-password" />
        <Button keepEnabled={allowWhileBusy} type="submit" disabled={busy}>Show my recovery information</Button>
        {passkeys && <Button keepEnabled={allowWhileBusy} disabled={busy} variant="subtle" onClick={() => validated(async () => { await enableWalletPasskey(password); clear(); })}>Enable device unlock</Button>}
        {phrase && <p className="break-all rounded-md bg-sunken p-4 font-sans">{phrase}</p>}
        <Hint>Device unlock depends on your browser and authenticator. Keep your password and recovery backup.</Hint>
        <Button keepEnabled={allowWhileBusy} variant="subtle" onClick={clear}>Done</Button>
      </form>}
    </div>}
    {Object.entries(form.formState.errors).map(([name, issue]) => <p key={name} role="alert" className="mt-2 text-sm text-bad">{issue.message}</p>)}
    {busy && <Hint>Securing your wallet…</Hint>}{error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
  </Panel>;
}
