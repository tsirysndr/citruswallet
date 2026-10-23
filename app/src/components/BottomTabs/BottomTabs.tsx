import { Pressable, View } from 'react-native';
import History from 'lucide-react-native/icons/rotate-ccw-clock';
import Send from 'lucide-react-native/icons/send';
import UserRound from 'lucide-react-native/icons/user-round';
import Wallet from 'lucide-react-native/icons/wallet';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from '../Typography';
import type { Screen } from '../../state';
const tabs: { name: Screen; icon: LucideIcon }[] = [
  { name: 'Account', icon: UserRound }, { name: 'Wallet', icon: Wallet },
  { name: 'Payments', icon: Send }, { name: 'Activity', icon: History },
];
export function BottomTabs({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return <View testID="bottom-navigation" style={{ marginHorizontal: 16, marginBottom: 10, marginTop: 8, padding: 6, borderRadius: 40,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e7df', flexDirection: 'row', gap: 4,
    boxShadow: '0px 3px 12px #20211a0d' }}>
    {tabs.map(({ name, icon: Icon }) => <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name}
      accessibilityState={{ selected: screen === name }} onPress={() => onChange(name)}
      style={{ flex: 1, minWidth: 0, minHeight: 62, borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 4,
        backgroundColor: screen === name ? '#c5f277' : 'transparent' }}>
      <Icon size={24} strokeWidth={1.75} color="#191916" />
      <Text numberOfLines={1} adjustsFontSizeToFit className="text-xs font-medium text-ink">{name}</Text>
    </Pressable>)}
  </View>;
}
