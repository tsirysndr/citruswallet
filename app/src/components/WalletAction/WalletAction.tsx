import { Pressable } from "react-native";
import { Text } from "../Typography";
import { Feather } from '@expo/vector-icons';

export function WalletAction({ action, onPress }: { action: 'link' | 'send'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    className={`min-h-[58px] flex-row items-center justify-center gap-2 rounded-full border px-3 ${action === 'link' ? 'border-lilac bg-lilac' : 'border-peach bg-peach'}`}>
    <Feather name={action === 'link' ? 'plus' : 'arrow-up-right'} size={19} color="#191916" />
    <Text className="text-sm font-medium text-ink">{action === 'link' ? 'Link wallet' : 'Send ETH'}</Text>
  </Pressable>;
}
