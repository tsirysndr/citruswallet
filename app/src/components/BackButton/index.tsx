import { useTheme } from '../../theme';
import { Pressable } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useAtomValue } from 'jotai';
import { busyAtom } from '../../state';
export function BackButton({ onPress, label = 'Back', disabled = false }: { onPress: () => void; label?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const busy = useAtomValue(busyAtom);
  const blocked = disabled || busy;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={onPress}
    style={{ alignSelf: 'flex-start', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: blocked ? 0.4 : 1 }}>
    <ChevronLeft size={26} color={colors.ink} accessible={false} />
  </Pressable>;
}
