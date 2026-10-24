import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCloudBackup, restoreCloudBackup, listCloudBackups, downloadCloudBackup, uploadCloudBackup, type CloudProvider, type CloudFile } from '@peachlet/wallet-core';
import { nativeVaultState, subscribeNativeVault, nativeProtection, readNativeSecret, createProtectedNativeVault, deviceUnlockAvailable } from '../../local-wallet';
import { selectWallet } from '../../wallet-preferences';
import { cloudConfigured, connectCloud } from '../../cloud-auth';
import { Text } from '../Typography';
import { FormField } from '../FormField';
import { Button, Heading } from '../ui';
import { ThemeSwitch } from '../ThemeSwitch';
export function CloudBackup({ onRestored }: { onRestored?: () => void }) {
  const state = useSyncExternalStore(subscribeNativeVault, nativeVaultState), restoring = state === 'absent';
  const deviceProtected = nativeProtection() === 'device';
  const [connection, setConnection] = useState<{ provider: CloudProvider; token: string } | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]), [file, setFile] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [deviceAvailable, setDeviceAvailable] = useState(false), [useDevice, setUseDevice] = useState(false);
  const active = useRef(true);
  const schema = z.object({ credential: z.string().max(1024), password: z.string().min(12, 'Use at least 12 characters.').max(1024), repeat: z.string().max(1024) }).superRefine((value, ctx) => {
    if (!restoring && !deviceProtected && !value.credential) ctx.addIssue({ code: 'custom', path: ['credential'], message: 'Enter your current wallet password or legacy PIN.' });
    if (!restoring && value.password !== value.repeat) ctx.addIssue({ code: 'custom', path: ['repeat'], message: 'Passwords do not match.' });
  });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { credential: '', password: '', repeat: '' } });
  useEffect(() => { active.current = true; void deviceUnlockAvailable().then(value => { if (active.current) { setDeviceAvailable(value); setUseDevice(value); } }).catch(() => {}); return () => { active.current = false; }; }, []);
  useEffect(() => { if (!connection) return; const timer = setTimeout(() => { setConnection(null); form.reset(); setFiles([]); setFile(''); }, 10 * 60_000); return () => clearTimeout(timer); }, [connection]);
  useEffect(() => { const sub = AppState.addEventListener('change', next => { if (next !== 'active') form.reset(); }); return () => sub.remove(); }, []);
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Cloud backup failed. Try again.'); } finally { if (active.current) setBusy(false); } };
  const connect = (provider: CloudProvider) => run(async () => {
    const token = await connectCloud(provider); if (!active.current) return;
    setConnection({ provider, token }); form.reset(); setFiles([]); setFile('');
    if (restoring) { const entries = await listCloudBackups(provider, token); if (active.current) setFiles(entries); }
  });
  const submit = () => { if (busy) return; return form.handleSubmit(values => run(async () => {
    if (!connection) throw new Error('Connect cloud storage first.');
    if (restoring) {
      if (!file) throw new Error('Choose a backup first.');
      const encrypted = await downloadCloudBackup(connection.provider, connection.token, file);
      const secret = await restoreCloudBackup(encrypted, values.password);
      if (!active.current || AppState.currentState !== 'active') throw new Error('Restore was interrupted. Try again.');
      await createProtectedNativeVault(secret, useDevice ? 'device' : 'password', useDevice ? '' : values.password);
      await selectWallet('citrus'); setConnection(null); form.reset(); setMessage('Wallet restored on this device.'); onRestored?.();
    } else {
      const secret = await readNativeSecret(values.credential);
      const encrypted = await createCloudBackup(secret, values.password);
      if (!active.current) return;
      await uploadCloudBackup(connection.provider, connection.token, encrypted);
      if (active.current) { setMessage('Encrypted backup saved and verified. Keep your backup password somewhere safe.'); form.reset(); setConnection(null); }
    }
  }))(); };
  return <View className="gap-4 rounded-3xl bg-surface p-5"><Heading title={restoring ? 'Restore from the cloud' : 'Cloud backup'} />
    <Text className="text-sm leading-6 text-muted">{restoring ? 'Choose the same cloud account used for your backup.' : 'Your recovery information is encrypted on this device before it reaches Google Drive or Dropbox. Choose a separate backup password of at least 12 characters.'}</Text>
    <Text className="text-sm leading-6 text-muted">Peachlet and your cloud provider cannot recover a forgotten backup password. Keep an offline copy of your recovery information too.</Text>
    {!connection ? <View className="gap-3">{(['google', 'dropbox'] as const).map(provider => <View key={provider} className="gap-1"><Button title={provider === 'google' ? 'Google Drive' : 'Dropbox'} disabled={busy || !cloudConfigured(provider)} onPress={() => connect(provider)} />{!cloudConfigured(provider) && <Text className="text-xs text-muted">Not available in this build yet</Text>}</View>)}</View> : <>
      <Text className="text-base font-bold">Connected to {connection.provider === 'google' ? 'Google Drive' : 'Dropbox'}</Text>
      {restoring ? <>{files.length ? files.map(entry => <Button key={entry.id} title={`${entry.id === file ? 'Selected · ' : ''}${entry.name}`} multiline tone={entry.id === file ? 'lime' : 'plain'} disabled={busy} onPress={() => setFile(entry.id)} />) : <Text>No Peachlet backups found in this cloud account.</Text>}
        {deviceAvailable && <View className="flex-row items-center justify-between gap-3"><Text className="flex-1">Unlock restored wallet with device PIN or biometrics</Text><ThemeSwitch accessibilityLabel="Use device unlock" value={useDevice} onValueChange={setUseDevice} disabled={busy} /></View>}
        {!useDevice && <Text className="text-sm text-muted">Your backup password will also unlock this wallet on this device.</Text>}
      </> : !deviceProtected && <FormField control={form.control} name="credential" label={nativeProtection() === 'legacy-pin' ? 'Previous Peachlet PIN' : 'Current wallet password'} secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={submit} />}
      <FormField control={form.control} name="password" label="Backup password" secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={submit} />
      {!restoring && <FormField control={form.control} name="repeat" label="Repeat backup password" secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={submit} />}
      <View className="mt-3 flex-row items-center gap-3"><View className="flex-1"><Button title="Disconnect" tone="ghost" disabled={busy} onPress={() => { setConnection(null); setFiles([]); setFile(''); form.reset(); }} /></View><View className="flex-[2]"><Button title={busy ? 'Working…' : restoring ? 'Restore wallet' : 'Save encrypted backup'} disabled={busy || restoring && !file} onPress={submit} /></View></View>
    </>}
    {!!message && <Text accessibilityRole="alert" className="text-sm">{message}</Text>}{!!error && <Text accessibilityRole="alert" className="text-sm text-red-500">{error}</Text>}
  </View>;
}
