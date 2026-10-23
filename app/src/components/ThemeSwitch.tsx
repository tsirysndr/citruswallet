import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

export function ThemeSwitch({ value, onValueChange, accessibilityLabel, disabled = false }: {
  value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string; disabled?: boolean;
}) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(position, { toValue: value ? 1 : 0, useNativeDriver: true, damping: 20, stiffness: 240, mass: 0.7 }).start();
  }, [position, value]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onValueChange(!value)}
    hitSlop={8} style={{ width: 50, height: 30, padding: 3, borderRadius: 15, backgroundColor: value ? '#c5f277' : '#d9dad2', opacity: disabled ? 0.4 : 1 }}>
    <Animated.View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? '#191916' : '#ffffff', transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }} />
  </Pressable>;
}
