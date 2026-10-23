import { useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import WalletIcon from 'lucide-react-native/icons/wallet';
import Link2 from 'lucide-react-native/icons/link-2';
import Copy from 'lucide-react-native/icons/copy';
import { useQueryClient } from '@tanstack/react-query';
import { nativeBalanceAddress, nativeVaultState, subscribeNativeVault } from '../../local-wallet';
import { configuredAddress, rememberExternalWallet, selectWallet, walletMode } from '../../wallet-preferences';
import { connect, linkWallet } from '../../wallet';
import { request } from '../../api';
import { useAction, useSession } from '../../hooks';
import { WalletIllustration } from '../WalletIllustration';
import { LocalWallet } from '../LocalWallet';
import { Text } from '../Typography';
import { Button } from '../ui';
export function WalletSetup({ onFinished, restart = false }: { onFinished?: () => void; restart?: boolean }) {
  const { data: session } = useSession();
  const vault = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const run = useAction(), query = useQueryClient();
  const existing = vault !== 'absent' || Boolean(configuredAddress());
  const [kind, setKind] = useState(walletMode());
  const [stage, setStage] = useState<'choice' | 'create' | 'import' | 'link' | 'done'>(() => !restart && existing ? 'link' : 'choice');
  const [editing, setEditing] = useState(restart || Boolean(onFinished));
  const current = configuredAddress();
  const links = session?.links.filter(link => link.chain_id === session.network.chainId) || [];
  const linked = links.find(link => current && link.address.toLowerCase() === current.toLowerCase()) || (!existing ? links.find(link => link.is_default) || links[0] : undefined);
  const [address, setAddress] = useState(current || linked?.address || '');
  const ready = stage === 'done' || (!editing && Boolean(linked));
  const choose = (value: 'citrus' | 'metamask', restore = false) => run(async () => {
    await selectWallet(value); setKind(value); setEditing(true);
    setStage(value === 'metamask' || vault !== 'absent' ? 'link' : restore ? 'import' : 'create');
  });
  const finish = () => run(async () => {
    if (!session) throw new Error('Reconnect to Citrus and try again.');
    await selectWallet(kind === 'metamask' ? 'metamask' : 'citrus');
    const account = session.did ? await linkWallet(session.network, true) : (await connect(session.network)).address;
    if (kind === 'metamask') await rememberExternalWallet(account);
    setAddress(account);
    if (session.did) {
      await request('setDefaultAddress', { address: account });
      await query.invalidateQueries();
    }
    setStage('done');
  });
  return <View className="gap-6">
    {!ready && <View className="flex-row justify-between"><Text className="text-xs text-muted">WALLET SETUP</Text><Text className="text-xs text-muted">{stage === 'choice' ? '1 · Choose' : stage === 'link' ? '3 · Connect' : '2 · Secure'}</Text></View>}
    {ready ? <View className="gap-5 rounded-3xl bg-white p-6"><View className="items-center"><WalletIllustration variant="ready" /></View>
      <Text className="text-center text-3xl font-semibold">{session?.did ? 'Your wallet is ready.' : 'A wallet of your own.'}</Text>
      <Text className="text-center text-base leading-6 text-muted">{session?.did ? `Ready to receive on ${session.network.name}. Your wallet address is linked to your Atmosphere account.` : 'Sign in next to link this wallet to your Atmosphere account.'}</Text>
      {!!(address || linked?.address) && <View className="gap-2 rounded-xl bg-canvas p-4"><Text className="text-xs text-muted">Your address</Text><View className="flex-row items-center gap-3"><Text selectable className="flex-1 font-mono text-sm">{address || linked?.address}</Text><Pressable accessibilityRole="button" accessibilityLabel="Copy wallet address" hitSlop={12} onPress={() => run(() => Clipboard.setStringAsync(address || linked!.address))}><Copy size={20} color="#292d26" /></Pressable></View></View>}
      {onFinished && <Button title="Open Citrus Wallet" onPress={onFinished} />}
    </View> : stage === 'choice' ? <>
      <View className="items-center"><WalletIllustration size={260} /></View>
      <View className="gap-3"><Text className="text-center text-3xl font-semibold">Make yourself at home.</Text><Text className="text-center text-base leading-6 text-muted">Choose how you’d like to use your wallet. Your keys always stay with you.</Text></View>
      <View className="gap-3">{([
        { id: 'citrus' as const, title: vault === 'absent' ? 'Create a Citrus wallet' : 'Use my Citrus wallet', subtitle: vault === 'absent' ? 'A fresh start. No extension needed.' : 'Continue with the wallet on this device.', Icon: WalletIcon, color: '#c5f277' },
        { id: 'metamask' as const, title: 'Connect MetaMask', subtitle: 'Keep using the wallet you already know.', Icon: Link2, color: '#ffe0d7' },
      ]).map(({ id, title, subtitle, Icon, color }) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={title} onPress={() => choose(id)} className="flex-row items-center gap-3 rounded-2xl border border-edge bg-white p-4"><View style={{ backgroundColor: color, padding: 12, borderRadius: 12 }}><Icon size={24} color="#292d26" /></View><View className="flex-1 gap-1"><Text className="text-base font-semibold">{title}</Text><Text className="text-sm leading-5 text-muted">{subtitle}</Text></View><ArrowRight size={18} color="#292d26" /></Pressable>)}</View>
      {vault === 'absent' && <Pressable accessibilityRole="button" accessibilityLabel="Restore a wallet" onPress={() => choose('citrus', true)}><Text className="text-center text-sm text-muted">Have a recovery phrase? <Text className="font-semibold text-ink underline">Restore a wallet</Text></Text></Pressable>}
    </> : stage === 'create' || stage === 'import' ? <LocalWallet key={stage} initialAction={stage} onCreated={() => { setAddress(nativeBalanceAddress() || ''); setStage(session?.did ? 'link' : 'done'); }} onCancel={() => setStage('choice')} /> : <View className="gap-5 rounded-3xl bg-white p-6">
      <View className="items-center"><WalletIllustration variant="connect" /></View><Text className="text-center text-2xl font-semibold">{session?.did ? 'Your handle, meet your wallet.' : 'Bring your wallet along.'}</Text>
      <Text className="text-center text-base leading-6 text-muted">{session?.did ? 'Your wallet address will be public, linked to your Atmosphere account, and set as your receiving default. Linking is free and never moves funds.' : 'Connect MetaMask to get started. You’ll link your Atmosphere account after signing in.'}</Text>
      <Button title={session?.did ? 'Link my wallet' : 'Connect MetaMask'} onPress={finish} />
      {kind === 'metamask' && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://metamask.io/download/')}><Text className="text-center text-sm text-muted underline">Need the MetaMask app?</Text></Pressable>}
      <Pressable accessibilityRole="button" onPress={() => setStage('choice')}><Text className="text-center text-sm text-muted">Choose a different wallet</Text></Pressable>
    </View>}
  </View>;
}
