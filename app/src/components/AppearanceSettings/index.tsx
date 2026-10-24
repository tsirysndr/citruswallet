import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Typography';
import { ThemeSwitch } from '../ThemeSwitch';
export function AppearanceSettings() {
  const { appearance, setAppearance } = useTheme();
  const [error, setError] = useState('');
  return <View className="gap-3 rounded-3xl bg-surface p-5">
    <View className="flex-row items-center justify-between gap-4"><View className="flex-1 gap-1"><Text className="text-base font-bold">Dark appearance</Text><Text className="text-sm text-muted">A true-black background. Saved on this device.</Text></View>
      <ThemeSwitch accessibilityLabel="Dark appearance" value={appearance === 'dark'} onValueChange={value => { setError(''); void setAppearance(value ? 'dark' : 'light').catch(() => setError('Could not save appearance. Please try again.')); }} />
    </View>{!!error && <Text accessibilityRole="alert" className="text-sm text-red-500">{error}</Text>}
  </View>;
}
