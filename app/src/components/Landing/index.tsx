import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import { Text } from '../Typography';

export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#ffb995' }} edges={['top', 'bottom']}>
    <StatusBar style="dark" />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Image source={require('../../../assets/icon.png')} style={{ width: 36, height: 36 }} /><Text className="font-bold" style={{ fontSize: 20, color: '#191916' }}>Peachlet</Text></View>
      <Pressable accessibilityRole="button" onPress={onGetStarted} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#191916', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14 }}><Text className="font-bold" style={{ color: '#fff', fontSize: 14 }}>Get started</Text><ArrowUpRight size={16} color="#fff" /></Pressable>
    </View>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 36 }}>
        <Text className="font-bold" style={{ color: '#482719', fontSize: 14, marginBottom: 20 }}>A little more human.</Text>
        <Text accessibilityRole="header" className="font-bold" style={{ color: '#191916', fontSize: 58, lineHeight: 62, letterSpacing: -2 }}>Send ETH.{'\n'}To a handle.</Text>
        <Text style={{ color: '#482719', fontSize: 19, lineHeight: 28, marginTop: 24 }}>Send crypto to a short, readable AT Protocol handle instead of a long wallet address. Your wallet. Your keys. Your people.</Text>
        <View style={{ gap: 12, marginTop: 36 }}><Text className="font-mono" style={{ color: '#482719', opacity: 0.5, textDecorationLine: 'line-through', fontSize: 17 }}>0x7F4a…9c2D</Text><Text className="font-mono" style={{ color: '#191916', fontSize: 20 }}>→ @alice.bsky.social</Text></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 24, paddingVertical: 20 }}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://peachlet.app/privacy')}><Text style={{ color: '#482719', paddingVertical: 10 }}>Privacy</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://peachlet.app/terms')}><Text style={{ color: '#482719', paddingVertical: 10 }}>Terms</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
