import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCloudBackup, restoreCloudBackup, listCloudBackups, downloadCloudBackup, uploadCloudBackup, type CloudProvider, type CloudFile } from '@peachlet/wallet-core';
import { backupLocalWallet, localWalletState, saveLocalWallet, subscribeWallet } from '../../local-wallet';
import { cloudConfigured, connectCloud, prepareGoogleAuth } from '../../cloud-auth';
import { Button, Heading, Hint, Input, Label, Panel } from '../ui';
export function CloudBackup({ onRestored }: { onRestored?: () => void }) {
  const state = useSyncExternalStore(subscribeWallet, localWalletState), restoring = state === 'absent';
  const [connection, setConnection] = useState<{ provider: CloudProvider; token: string } | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]), [file, setFile] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const active = useRef(true);
  const schema = z.object({ credential: z.string().max(1024), password: z.string().min(12, 'Use at least 12 characters.').max(1024), repeat: z.string().max(1024) }).superRefine((value, ctx) => {
    if (!restoring && !value.credential) ctx.addIssue({ code: 'custom', path: ['credential'], message: 'Enter your current wallet password.' });
    if (!restoring && value.password !== value.repeat) ctx.addIssue({ code: 'custom', path: ['repeat'], message: 'Passwords do not match.' });
  });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { credential: '', password: '', repeat: '' } });
  useEffect(() => { active.current = true; void prepareGoogleAuth().then(() => { if (active.current) setGoogleReady(true); }).catch(() => { if (active.current) setError('Google sign-in could not load. Reload this page to retry.'); }); return () => { active.current = false; }; }, []);
  useEffect(() => { if (!connection) return; const timer = setTimeout(() => { setConnection(null); form.reset(); setFiles([]); setFile(''); }, 10 * 60_000); return () => clearTimeout(timer); }, [connection]);
  useEffect(() => { const hide = () => { if (document.hidden) form.reset(); }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, []);
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Cloud backup failed. Try again.'); } finally { if (active.current) setBusy(false); } };
  const connect = (provider: CloudProvider) => run(async () => {
    const token = await connectCloud(provider); if (!active.current) return;
    setConnection({ provider, token }); form.reset(); setFiles([]); setFile('');
    if (restoring) { const entries = await listCloudBackups(provider, token); if (active.current) setFiles(entries); }
  });
  const submit = form.handleSubmit(values => run(async () => {
    if (!connection) throw new Error('Connect cloud storage first.');
    if (restoring) {
      if (!file) throw new Error('Choose a backup first.');
      const encrypted = await downloadCloudBackup(connection.provider, connection.token, file);
      const secret = await restoreCloudBackup(encrypted, values.password);
      if (!active.current || document.hidden) throw new Error('Restore was interrupted. Try again.');
      await saveLocalWallet(secret, values.password);
      localStorage.setItem('citrus:wallet-mode', 'citrus');
      setMessage('Wallet restored on this device.'); setConnection(null); form.reset(); onRestored?.();
    } else {
      const secret = await backupLocalWallet(values.credential);
      const encrypted = await createCloudBackup(secret, values.password);
      if (!active.current) return;
      await uploadCloudBackup(connection.provider, connection.token, encrypted);
      if (active.current) { setMessage('Encrypted backup saved and verified. Keep your backup password somewhere safe.'); form.reset(); setConnection(null); }
    }
  }));
  return <Panel><Heading>{restoring ? 'Restore from the cloud' : 'Cloud backup'}</Heading>
    <Hint className="mt-2">{restoring ? 'Choose the same cloud account used for your backup. Your backup password will also protect this wallet in this browser.' : 'Your recovery information is encrypted on this device before it reaches Google Drive or Dropbox. Use a separate backup password of at least 12 characters.'}</Hint>
    <Hint className="mt-2">Peachlet and your cloud provider cannot recover a forgotten backup password. Keep an offline copy of your recovery information too.</Hint>
    {!connection ? <div className="mt-4 flex flex-wrap gap-3">{(['google', 'dropbox'] as const).map(provider => <div key={provider}><Button disabled={busy || !cloudConfigured(provider) || provider === 'google' && !googleReady} onClick={() => connect(provider)}>{provider === 'google' ? 'Google Drive' : 'Dropbox'}</Button>{!cloudConfigured(provider) && <Hint>Not available yet</Hint>}</div>)}</div> : <form noValidate onSubmit={e => { e.preventDefault(); void submit(); }} className="mt-4 flex flex-col gap-3">
      <p className="text-sm font-semibold">Connected to {connection.provider === 'google' ? 'Google Drive' : 'Dropbox'}</p>
      {restoring ? <>{files.length ? <><Label htmlFor="cloud-file">Backup to restore</Label><select id="cloud-file" disabled={busy} value={file} onChange={e => setFile(e.target.value)} className="rounded-md border border-edge bg-sunken p-3"><option value="">Choose a backup</option>{files.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></> : <Hint>No Peachlet backups found in this cloud account.</Hint>}</> : <><Label htmlFor="cloud-credential">Current wallet password</Label><Input id="cloud-credential" type="password" autoComplete="current-password" {...form.register('credential')} /></>}
      <Label htmlFor="cloud-password">Backup password</Label><Input id="cloud-password" type="password" autoComplete={restoring ? 'current-password' : 'new-password'} {...form.register('password')} />
      {!restoring && <><Label htmlFor="cloud-repeat">Repeat backup password</Label><Input id="cloud-repeat" type="password" autoComplete="new-password" {...form.register('repeat')} /></>}
      {Object.values(form.formState.errors).map((issue, index) => <p role="alert" key={index} className="text-sm text-bad">{issue.message}</p>)}
      <div className="mt-3 flex items-center justify-end gap-3"><Button variant="subtle" disabled={busy} onClick={() => { setConnection(null); setFiles([]); setFile(''); form.reset(); }}>Disconnect</Button><Button type="submit" disabled={busy || restoring && !file}>{busy ? 'Working…' : restoring ? 'Restore wallet' : 'Save encrypted backup'}</Button></div>
    </form>}
    {!!message && <p role="status" className="mt-3 text-sm text-good">{message}</p>}{!!error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
  </Panel>;
}
