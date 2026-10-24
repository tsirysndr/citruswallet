import { BackButton } from "../BackButton";
import { useAtomValue } from 'jotai';
import { busyAtom } from '../../state';
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
export function LocalWallet({ allowWhileBusy = false, initialAction, onCreated, onCancel, onDismiss }: { allowWhileBusy?: boolean; initialAction?: 'create' | 'import'; onCreated?: () => void; onCancel?: () => void; onDismiss?: () => void }) {
  const globalBusy = useAtomValue(busyAtom);
  const state = useSyncExternalStore(subscribeNativeVault, nativeVaultState), protection = nativeProtection();
  const [mode, setMode] = useState<string>(initialAction || 'home'), [confirmed, setConfirmed] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [backup, setBackup] = useState('');
  const form = useForm({ resolver: zodResolver(walletForm(mode === 'upgrade' ? 'upgrade' : state === 'absent' ? 'save' : 'unlock', protection)), defaultValues: { ...walletDefaults, secret: initialAction === 'create' ? createRecoveryPhrase() : '' } });
  const values = form.watch();
  const clear = () => { form.reset({ ...walletDefaults, protection: available === false ? 'password' : 'device' }); setConfirmed(false); setBackup(''); setMode('home'); };
  useEffect(() => { void deviceUnlockAvailable().then(value => { setAvailable(value); if (!value) form.setValue('protection', 'password'); }); }, []);
  useEffect(() => { const sub = AppState.addEventListener('change', next => { if (next !== 'active' && !deviceAuthenticationActive()) { clear(); onCancel?.(); } }); return () => sub.remove(); }, []);
  const act = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  const submit = (fn: (value: typeof walletDefaults) => Promise<void>) => { if (busy || (globalBusy && !allowWhileBusy)) return; return form.handleSubmit(value => act(() => fn(value)))(); };
  const save = () => { if (available === null) return; return submit(async value => { if (mode === 'create' && !confirmed) throw new Error('Check your recovery words.'); await createProtectedNativeVault(normalizeSecret(value.secret, value.kind), value.protection, value.password); clear(); onCreated?.(); }); };
  const unlock = () => submit(async value => { await unlockNativeVault(value.credential); clear(); });
  const reveal = () => submit(async value => { const secret = await readNativeSecret(value.credential); if (AppState.currentState === 'active') setBackup(secret.value); form.setValue('credential', ''); });
  const upgrade = () => { if (available === null) return; return submit(async value => { await upgradeNativeProtection(value.credential, value.protection, value.password); clear(); }); };
  const primary = () => { if (mode === 'upgrade') return upgrade(); if (state === 'locked') return unlock(); if (mode === 'backup') return reveal(); if (state === 'absent' && (mode === 'import' || confirmed)) return save(); };
  const credential = protection !== 'device' && <FormField control={form.control} name="credential" label={protection === 'legacy-pin' ? 'Previous Citrus PIN' : 'Wallet password'} onSubmitEditing={primary} returnKeyType="done" secureTextEntry autoCapitalize="none" autoCorrect={false} keyboardType={protection === 'legacy-pin' ? 'number-pad' : 'default'} />;
  const choices = <View className="gap-3">
    <Text className="text-base font-semibold">How would you like to unlock?</Text>
    {available && <Button keepEnabled={allowWhileBusy} title={`Device PIN or biometrics${values.protection === 'device' ? ' · selected' : ''}`} tone={values.protection === 'device' ? undefined : onDismiss ? 'ghost' : 'plain'} onPress={() => form.setValue('protection', 'device', { shouldValidate: form.formState.isSubmitted })} />}
    <Button keepEnabled={allowWhileBusy} title={`Use a wallet password${values.protection === 'password' ? ' · selected' : ''}`} tone={values.protection === 'password' ? undefined : onDismiss ? 'ghost' : 'plain'} onPress={() => form.setValue('protection', 'password', { shouldValidate: form.formState.isSubmitted })} />
    {values.protection === 'device' ? <Text className="text-sm leading-6 text-muted">Use your phone’s existing screen-lock PIN, pattern, password, or biometrics. Citrus never sees your device PIN.</Text> : <><Text className="text-sm text-muted">Choose a password of at least 12 characters to encrypt this wallet.</Text><FormField control={form.control} name="password" label="Wallet password" onSubmitEditing={primary} returnKeyType="done" secureTextEntry autoCapitalize="none" autoCorrect={false} /><FormField control={form.control} name="repeat" label="Repeat password" onSubmitEditing={primary} returnKeyType="done" secureTextEntry autoCapitalize="none" autoCorrect={false} /></>}
  </View>;
  return <View className={`gap-4 rounded-3xl bg-white ${onDismiss ? "p-0" : "p-5"}`}><Heading title={mode === 'create' ? confirmed ? 'Protect your wallet' : 'Back up your wallet' : mode === 'import' ? 'Restore your wallet' : 'Wallet security'} subtitle="Your keys stay on this device." />
    {state === 'absent' && mode === 'home' && <><Button title="Create a wallet" onPress={() => { form.setValue('secret', createRecoveryPhrase()); form.setValue('kind', 'mnemonic'); setMode('create'); }} /><Button title="I already have a wallet" tone={onDismiss ? "ghost" : "plain"} onPress={() => setMode('import')} /></>}
    {state === 'absent' && ['create', 'import'].includes(mode) && <>
      {mode === 'create' ? !confirmed && <RecoveryBackup phrase={values.secret} onConfirmed={setConfirmed} allowWhileBusy={allowWhileBusy} /> : <><Button title={values.kind === 'mnemonic' ? 'Using recovery words · switch to private key' : 'Using private key · switch to recovery words'} tone={onDismiss ? "ghost" : "plain"} onPress={() => { form.setValue('secret', ''); form.setValue('kind', values.kind === 'mnemonic' ? 'privateKey' : 'mnemonic'); form.clearErrors('secret'); }} /><FormField control={form.control} name="secret" label={values.kind === 'mnemonic' ? 'Recovery words' : 'Private key'} onSubmitEditing={primary} returnKeyType="done" secureTextEntry autoCapitalize="none" autoCorrect={false} /><Text className="text-sm text-muted">Restores the first Ethereum account. Extra BIP-39 passphrases are not supported.</Text></>}
      {(mode === 'import' || confirmed) && <>{choices}<Button title={busy ? 'Securing wallet…' : 'Save my wallet'} disabled={busy || available === null} onPress={save} />{mode === 'create' && <BackButton label="Back to recovery phrase" disabled={busy} onPress={() => setConfirmed(false)} />}</>}
      <Button title="Cancel" tone={onDismiss ? "ghost" : "plain"} disabled={busy} onPress={() => { clear(); onCancel?.(); }} />
    </>}
    {state === 'locked' && mode !== 'upgrade' && <>{credential}{protection === 'device' && <Text>Unlock with your phone’s screen lock or biometrics.</Text>}<View className="mt-3 flex-row items-center gap-3">{onDismiss && <View className="flex-1"><Button keepEnabled title="Cancel" tone="ghost" onPress={onDismiss} /></View>}<View className="flex-1"><Button keepEnabled={allowWhileBusy} title={protection === 'device' ? 'Unlock with device' : 'Unlock wallet'} disabled={busy} onPress={unlock} /></View></View></>}
    {state === 'unlocked' && mode !== 'upgrade' && <><Text className="font-mono text-sm">{nativeAddress()}</Text><Text>Locks when you leave the app or after 15 minutes without a wallet action.</Text><Button title="Lock wallet" tone={onDismiss ? "ghost" : "plain"} onPress={() => { clear(); lockNativeWallet(); }} /><Button title="Backup & security" tone={onDismiss ? "ghost" : "plain"} onPress={() => setMode('backup')} />
      {mode === 'backup' && <>{credential}<Button title="Show recovery information" disabled={busy} onPress={reveal} />{!!backup && <Text>{backup}</Text>}<Button title="Done" tone={onDismiss ? "ghost" : "plain"} onPress={clear} /></>}
    </>}
    {state !== 'absent' && mode !== 'upgrade' && <>{protection === 'legacy-pin' && <Text className="text-sm text-muted">This wallet uses an older Citrus PIN. Enter it once to switch to device unlock or a wallet password.</Text>}<Button title={protection === 'legacy-pin' ? "Upgrade wallet protection" : "Change unlock method"} tone={onDismiss ? "ghost" : "plain"} onPress={() => setMode('upgrade')} /></>}
    {mode === 'upgrade' && <>{credential}{choices}<View className="flex-row items-center gap-3"><View className="flex-1"><Button title="Cancel" tone="ghost" disabled={busy} onPress={clear} /></View><View className="flex-1"><Button title="Update protection" disabled={busy || available === null} onPress={upgrade} /></View></View></>}
    {!!error && <Text accessibilityRole="alert" className="text-red-700">{error}</Text>}
  </View>;
}
