import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../hooks';
import { disablePush, enablePush, pushStatus } from '../../notifications';
import { Text } from '../Typography';
import { ThemeSwitch } from '../ThemeSwitch';
import { Button } from '../ui';
import { ContentSkeleton } from '../ContentSkeleton';

export function NotificationSettings() {
  const { data: session } = useSession();
  const query = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = ['push-settings', session?.did];
  const { data, isPending, error: loadError, refetch } = useQuery({ queryKey: key, queryFn: pushStatus, enabled: !!session?.did });
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void refetch(); });
    return () => sub.remove();
  }, [refetch]);
  if (!session?.did) return <Text>Sign in to manage payment notifications.</Text>;
  const change = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await (enabled ? enablePush() : disablePush());
      await query.invalidateQueries({ queryKey: ['push-settings'] });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update notifications. Try again.'); }
    finally { setBusy(false); }
  };
  return <View className="gap-4 rounded-3xl bg-surface p-5">
    <Text className="text-xl font-bold">Payment notifications</Text>
    <Text className="text-sm text-muted">Know when a payment arrives, even when Peachlet is closed.</Text>
    {isPending ? <ContentSkeleton variant="line" label="Checking notification settings" /> : loadError ? <Button title="Retry notification settings" tone="plain" onPress={() => void refetch()} /> : <>
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-1"><Text className="text-base font-semibold">Push notifications</Text><Text className="text-sm text-muted">{data?.enabled ? 'Enabled on this device' : data?.blocked ? 'Blocked in device settings' : 'Off on this device'}</Text></View>
        <ThemeSwitch accessibilityLabel="Push notifications" value={!!data?.enabled} disabled={busy} onValueChange={value => void change(value)} />
      </View>
      {data?.blocked && <Button title="Open device settings" tone="plain" onPress={() => void Linking.openSettings()} />}
      {data?.registered && !data.enabled && <Button title="Stop notifications on this device" tone="plain" disabled={busy} onPress={() => void change(false)} />}
    </>}
    {!!error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
  </View>;
}
