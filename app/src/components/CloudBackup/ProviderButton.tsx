import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAtomValue } from 'jotai';
import type { CloudProvider } from '@peachlet/wallet-core';
import { busyAtom } from '../../state';
import { Text } from '../Typography';
export function ProviderButton({ provider, disabled, onPress }: { provider: CloudProvider; disabled: boolean; onPress: () => void }) {
  const google = provider === 'google', globalBusy = useAtomValue(busyAtom), unavailable = disabled || globalBusy;
  return <Pressable accessibilityRole="button" accessibilityLabel={google ? 'Google Drive' : 'Dropbox'} accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={onPress} android_ripple={{ color: google ? '#e8e8e8' : '#004bcc' }} style={{ width: '100%', minHeight: 52, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: google ? '#ffffff' : '#0061ff', borderWidth: 1, borderColor: google ? '#c7c7c7' : '#0061ff', opacity: unavailable ? 0.45 : 1 }}>
    <View testID={`${provider}-button-content`} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 26 }}>
    {google ? <Image source={require('../../../assets/cloud/google-drive.png')} style={{ width: 24, height: 24 }} accessible={false} /> : <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}><Path fill="#ffffff" d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" /></Svg>}
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-sm font-semibold" style={{ flexShrink: 1, color: google ? '#1f1f1f' : '#ffffff' }}>{google ? 'Google Drive' : 'Dropbox'}</Text>
    </View>
  </Pressable>;
}
