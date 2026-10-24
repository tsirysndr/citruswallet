import { BackButton } from "../components/BackButton";
import { nativeVaultState, subscribeNativeVault } from "../local-wallet";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { useSetAtom } from 'jotai';
import { screenAtom, walletSetupAtom } from '../state';
import { Text } from '../components/Typography';
import { Heading, Button } from '../components/ui';
import { LocalWallet } from '../components/LocalWallet';
import { NetworkSettings } from '../components/NetworkSettings';
import { ConnectedAddresses } from '../components/ConnectedAddresses';
import Shield from 'lucide-react-native/icons/shield';
import Globe from 'lucide-react-native/icons/globe';
import Wallet from 'lucide-react-native/icons/wallet';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
export function Settings() {
  const vault = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const [section, setSection] = useState<string | null>(null);
  const go = useSetAtom(screenAtom), setup = useSetAtom(walletSetupAtom);
  const back = () => section ? setSection(null) : go('Account');
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [section]);
  return <View className="gap-5"><BackButton label={section ? 'Back to settings' : 'Back'} onPress={back} />
    <Heading title="Settings" subtitle="Make Citrus feel like yours." />
    {!section ? <><View className="overflow-hidden rounded-3xl bg-white">{[
      { id: 'security', title: 'Security & backup', detail: 'Unlock, biometrics, and recovery', Icon: Shield, color: '#ddd7ff' },
      { id: 'network', title: 'Network', detail: 'MegaETH, Ethereum, or your own RPC', Icon: Globe, color: '#cbeeff' },
      { id: 'addresses', title: 'Connected addresses', detail: 'Manage your receiving address', Icon: Wallet, color: '#ffe0d7' },
    ].map(({ id, title, detail, Icon, color }) => <Pressable key={id} accessibilityRole="button" onPress={() => setSection(id)} className="flex-row items-center gap-3 p-5"><View style={{ backgroundColor: color, padding: 12, borderRadius: 12 }}><Icon size={22} color="#292d26" /></View><View className="flex-1 gap-1"><Text className="text-base font-semibold">{title}</Text><Text className="text-sm text-muted">{detail}</Text></View><ChevronRight size={18} color="#292d26" /></Pressable>)}</View>
      <Button title="Set up or connect a wallet" tone="plain" onPress={() => { setup(true); go('Wallet'); }} /></> : section === 'security' ? vault === 'absent' ? <Text>Create a Citrus wallet to manage its security and backup here.</Text> : <LocalWallet /> : section === 'network' ? <NetworkSettings /> : <ConnectedAddresses />}
  </View>;
}
