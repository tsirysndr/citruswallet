import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRecoveryPhrase, normalizeSecret } from '@citruswallet/wallet-core';
import { createProtectedNativeVault, deviceAuthenticationActive, deviceUnlockAvailable, lockNativeWallet, nativeAddress, nativeProtection, nativeVaultState, readNativeSecret, subscribeNativeVault, unlockNativeVault, upgradeNativeProtection } from '../../local-wallet';
import { walletDefaults, walletForm } from '../../validation';
import { RecoveryBackup } from '../RecoveryBackup';
import { FormField } from '../FormField';
import { Text } from '../Typography';
import { Button, Heading } from '../ui';
export function LocalWallet({ allowWhileBusy = false, initialAction, onCreated, onCancel }: { allowWhileBusy?: boolean; initialAction?: 'create' | 'import'; onCreated?: () => void; onCancel?: () => void }) {
  const state = useSyncExternalStore(subscribeNativeVault, nativeVaultState), protection = nativeProtection();
  const [mode, setMode] = useState<string>(initialAction || 'home'), [confirmed, setConfirmed] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [backup, setBackup] = useState('');
  const form = useForm({ resolver: zodResolver(walletForm(mode === 'upgrade' ? 'upgrade' : state === 'absent' ? 'save' : 'unlock', protection)), defaultValues: { ...walletDefaults, secret: initialAction === 'create' ? createRecoveryPhrase() : '' } });
  const values = form.watch();
  const clear = () => { form.reset({ ...walletDefaults, protection: available === false ? 'password' : 'device' }); setConfirmed(false); setBackup(''); setMode('home'); };
  useEffect(() => { void deviceUnlockAvailable().then(value => { setAvailable(value); if (!value) form.setValue('protection', 'password'); }); }, []);
  useEffect(() => { const sub = AppState.addEventListener('change', next => { if (next !== 'active' && !deviceAuthenticationActive()) { clear(); onCancel?.(); } }); return () => sub.remove(); }, []);
  const act = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  const submit = (fn: (value: typeof walletDefaults) => Promise<void>) => form.handleSubmit(value => act(() => fn(value)))();
  const credential = protection !== 'device' && <FormField control={form.control} name="credential" label={protection === 'legacy-pin' ? 'Previous Citrus PIN' : 'Wallet password'} secureTextEntry autoCapitalize="none" autoCorrect={false} keyboardType={protection === 'legacy-pin' ? 'number-pad' : 'default'} />;
  const choices = <View className="gap-3">
    <Text className="text-base font-semibold">How would you like to unlock?</Text>
    {available && <Button keepEnabled={allowWhileBusy} title={`Device PIN or biometrics${values.protection === 'device' ? ' · selected' : ''}`} tone={values.protection === 'device' ? undefined : 'plain'} onPress={() => form.setValue('protection', 'device', { shouldValidate: form.formState.isSubmitted })} />}
    <Button keepEnabled={allowWhileBusy} title={`Use a wallet password${values.protection === 'password' ? ' · selected' : ''}`} tone={values.protection === 'password' ? undefined : 'plain'} onPress={() => form.setValue('protection', 'password', { shouldValidate: form.formState.isSubmitted })} />
    {values.protection === 'device' ? <Text className="text-sm leading-6 text-muted">Use your phone’s existing screen-lock PIN, pattern, password, or biometrics. Citrus never sees your device PIN.</Text> : <><Text className="text-sm text-muted">Choose a password of at least 12 characters to encrypt this wallet.</Text><FormField control={form.control} name="password" label="Wallet password" secureTextEntry autoCapitalize="none" autoCorrect={false} /><FormField control={form.control} name="repeat" label="Repeat password" secureTextEntry autoCapitalize="none" autoCorrect={false} /></>}
  </View>;
  return <View className="gap-4 rounded-3xl bg-white p-5"><Heading title={mode === 'create' ? confirmed ? 'Protect your wallet' : 'Back up your wallet' : mode === 'import' ? 'Restore your wallet' : 'Wallet security'} subtitle="Your keys stay on this device." />
    {state === 'absent' && mode === 'home' && <><Button title="Create a wallet" onPress={() => { form.setValue('secret', createRecoveryPhrase()); form.setValue('kind', 'mnemonic'); setMode('create'); }} /><Button title="I already have a wallet" tone="plain" onPress={() => setMode('import')} /></>}
    {state === 'absent' && ['create', 'import'].includes(mode) && <>
      {mode === 'create' ? !confirmed && <RecoveryBackup phrase={values.secret} onConfirmed={setConfirmed} allowWhileBusy={allowWhileBusy} /> : <><Button title={values.kind === 'mnemonic' ? 'Using recovery words · switch to private key' : 'Using private key · switch to recovery words'} tone="plain" onPress={() => { form.setValue('secret', ''); form.setValue('kind', values.kind === 'mnemonic' ? 'privateKey' : 'mnemonic'); form.clearErrors('secret'); }} /><FormField control={form.control} name="secret" label={values.kind === 'mnemonic' ? 'Recovery words' : 'Private key'} secureTextEntry autoCapitalize="none" autoCorrect={false} /><Text className="text-sm text-muted">Restores the first Ethereum account. Extra BIP-39 passphrases are not supported.</Text></>}
      {(mode === 'import' || confirmed) && <>{choices}<Button title={busy ? 'Securing wallet…' : 'Save my wallet'} disabled={busy || available === null} onPress={() => submit(async value => { if (mode === 'create' && !confirmed) throw new Error('Check your recovery words.'); await createProtectedNativeVault(normalizeSecret(value.secret, value.kind), value.protection, value.password); clear(); onCreated?.(); })} />{mode === 'create' && <Button title="Back to recovery phrase" tone="plain" disabled={busy} onPress={() => setConfirmed(false)} />}</>}
      <Button title="Cancel" tone="plain" disabled={busy} onPress={() => { clear(); onCancel?.(); }} />
    </>}
    {state === 'locked' && mode !== 'upgrade' && <>{credential}{protection === 'device' && <Text>Unlock with your phone’s screen lock or biometrics.</Text>}<Button keepEnabled={allowWhileBusy} title={protection === 'device' ? 'Unlock with device' : 'Unlock wallet'} disabled={busy} onPress={() => submit(async value => { await unlockNativeVault(value.credential); clear(); })} /></>}
    {state === 'unlocked' && mode !== 'upgrade' && <><Text className="font-mono text-sm">{nativeAddress()}</Text><Text>Locks when you leave the app or after 5 minutes without a wallet action.</Text><Button title="Lock wallet" tone="plain" onPress={() => { clear(); lockNativeWallet(); }} /><Button title="Backup & security" tone="plain" onPress={() => setMode('backup')} />
      {mode === 'backup' && <>{credential}<Button title="Show recovery information" disabled={busy} onPress={() => submit(async value => { const secret = await readNativeSecret(value.credential); if (AppState.currentState === 'active') setBackup(secret.value); form.setValue('credential', ''); })} />{!!backup && <Text>{backup}</Text>}<Button title="Done" tone="plain" onPress={clear} /></>}
    </>}
    {state !== 'absent' && mode !== 'upgrade' && <>{protection === 'legacy-pin' && <Text className="text-sm text-muted">This wallet uses an older Citrus PIN. Enter it once to switch to device unlock or a wallet password.</Text>}<Button title={protection === 'legacy-pin' ? "Upgrade wallet protection" : "Change unlock method"} tone="plain" onPress={() => setMode('upgrade')} /></>}
    {mode === 'upgrade' && <>{credential}{choices}<Button title="Update protection" disabled={busy || available === null} onPress={() => submit(async value => { await upgradeNativeProtection(value.credential, value.protection, value.password); clear(); })} /><Button title="Cancel" tone="plain" disabled={busy} onPress={clear} /></>}
    {!!error && <Text accessibilityRole="alert" className="text-red-700">{error}</Text>}
  </View>;
}
