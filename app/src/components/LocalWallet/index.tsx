import { RecoveryBackup } from "../RecoveryBackup";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import { createRecoveryPhrase, normalizeSecret, type WalletSecret } from '@citruswallet/wallet-core';
import { canUseBiometrics, createNativeVault, enableNativeBiometrics, lockNativeWallet, nativeAddress, nativeVaultState, readNativeSecret, subscribeNativeVault, unlockNativeBiometrics, unlockNativeVault } from '../../local-wallet';
import { Text } from '../Typography';
import { Button, Field, Heading } from '../ui';
export function LocalWallet({ allowWhileBusy = false, initialAction, onCreated, onCancel }: { allowWhileBusy?: boolean; initialAction?: 'create' | 'import'; onCreated?: () => void; onCancel?: () => void }) {
  const state = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const [mode, setMode] = useState(initialAction || 'home'), [kind, setKind] = useState<WalletSecret['kind']>('mnemonic');
  const [secret, setSecret] = useState(() => initialAction === 'create' ? createRecoveryPhrase() : ''), [confirmed, setConfirmed] = useState(false);
  const [pin, setPin] = useState(''), [repeat, setRepeat] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const clear = () => { setSecret(''); setConfirmed(false); setPin(''); setRepeat(''); setMode('home'); };
  useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s !== 'active') { clear(); onCancel?.(); } }); return () => sub.remove(); }, []);
  const act = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  return <View className="gap-4 rounded-3xl bg-white p-5"><Heading title={mode === "create" ? confirmed ? "Protect your wallet" : "Back up your wallet" : mode === "import" ? "Restore your wallet" : "Wallet security"} subtitle="Your keys stay on this device. No extension needed." />
    {state === 'absent' && mode === 'home' && <><Button keepEnabled={allowWhileBusy} title="Create a wallet" onPress={() => { setSecret(createRecoveryPhrase()); setMode('create'); }} /><Button keepEnabled={allowWhileBusy} title="I already have a wallet" tone="plain" onPress={() => setMode('import')} /></>}
    {state === 'absent' && ['create', 'import'].includes(mode) && <>
      {mode === 'create' ? !confirmed && <RecoveryBackup key={secret} phrase={secret} onConfirmed={setConfirmed} allowWhileBusy={allowWhileBusy} /> : <><Button keepEnabled={allowWhileBusy} title={kind === 'mnemonic' ? 'Using recovery words · switch to private key' : 'Using private key · switch to recovery words'} tone="plain" onPress={() => { setSecret(''); setKind(kind === 'mnemonic' ? 'privateKey' : 'mnemonic'); }} /><Field label={kind === 'mnemonic' ? 'Recovery words' : 'Private key'} value={secret} onChangeText={setSecret} autoCorrect={false} autoCapitalize="none" secureTextEntry /><Text>Restores the first Ethereum account. Extra BIP-39 passphrases are not supported.</Text></>}
      {(mode === "import" || confirmed) && <>
      <Field label="Create a wallet PIN (6–12 digits)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={12} /><Field label="Repeat PIN" value={repeat} onChangeText={setRepeat} keyboardType="number-pad" secureTextEntry maxLength={12} />
      <Button keepEnabled={allowWhileBusy} title={busy ? 'Securing wallet…' : 'Save my wallet'} disabled={busy} onPress={() => act(async () => { if (pin !== repeat) throw new Error('PINs do not match.'); if (mode === 'create' && !confirmed) throw new Error('Check your recovery words.'); await createNativeVault(normalizeSecret(secret, mode === 'create' ? 'mnemonic' : kind), pin); clear(); onCreated?.(); })} />{mode === "create" && <Button title="Back to recovery phrase" tone="plain" disabled={busy} onPress={() => setConfirmed(false)} />}</>}<Button keepEnabled={allowWhileBusy} title="Cancel" tone="plain" disabled={busy} onPress={() => { clear(); onCancel?.(); }} />
    </>}
    {state === 'locked' && <><Field label="Wallet PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={12} /><Button keepEnabled={allowWhileBusy} title="Unlock wallet" disabled={busy} onPress={() => act(async () => { await unlockNativeVault(pin); clear(); })} />{canUseBiometrics() && <Button keepEnabled={allowWhileBusy} title="Unlock with biometrics" tone="plain" disabled={busy} onPress={() => act(unlockNativeBiometrics)} />}</>}
    {state === 'unlocked' && <><Text className="font-mono text-sm">{nativeAddress()}</Text><Text>Locks when you leave the app or after 5 minutes without a wallet action.</Text><Button keepEnabled={allowWhileBusy} title="Lock wallet" tone="plain" onPress={() => { clear(); lockNativeWallet(); }} /><Button keepEnabled={allowWhileBusy} title="Backup & security" tone="plain" onPress={() => setMode('backup')} />
      {mode === 'backup' && <><Field label="Confirm wallet PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={12} /><Button keepEnabled={allowWhileBusy} title="Show recovery information" disabled={busy} onPress={() => act(async () => { const value = await readNativeSecret(pin); if (AppState.currentState === 'active') { setSecret(value.value); setPin(''); } })} />{canUseBiometrics() && <Button keepEnabled={allowWhileBusy} title="Enable biometric unlock" disabled={busy} onPress={() => act(async () => { await enableNativeBiometrics(pin); clear(); })} />}{!!secret && <Text className="font-mono">{secret}</Text>}<Button keepEnabled={allowWhileBusy} title="Done" tone="plain" onPress={clear} /></>}
    </>}
    {!!error && <Text accessibilityRole="alert" className="text-red-700">{error}</Text>}
  </View>;
}
