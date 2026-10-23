import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { reviewAtom } from '../../state';
import { useAction, useSession } from '../../hooks';
import { currentRpc, saveNetwork, selectedChain } from '../../network';
import { lockNativeWallet } from '../../local-wallet';
import { Button, Field, Heading } from '../ui';
import { Text } from '../Typography';
export function NetworkSettings() {
  const { data: session } = useSession();
  const [chain, setChain] = useState(selectedChain() || String(session?.network.chainId || 4326));
  const [rpc, setRpc] = useState(currentRpc());
  const run = useAction(), query = useQueryClient(), setReview = useSetAtom(reviewAtom);
  return <View className="gap-4 rounded-3xl bg-white p-5"><Heading title="Network" subtitle="Switching networks does not move your funds." />
    <Button title={`MegaETH${chain === '4326' ? ' · selected' : ''}`} tone={chain === '4326' ? undefined : 'plain'} onPress={() => { setChain('4326'); setRpc(''); }} />
    <Button title={`Ethereum mainnet${chain === '1' ? ' · selected' : ''}`} tone={chain === '1' ? undefined : 'plain'} onPress={() => { setChain('1'); setRpc(''); }} />
    <Field label="Custom HTTPS RPC (optional)" value={rpc} onChangeText={setRpc} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
    <Text>Your RPC provider can see your address and transactions. Citrus verifies payments independently.</Text>
    <Button title="Save network" onPress={() => run(async () => { await saveNetwork(chain, rpc); lockNativeWallet(); setReview(null); await query.cancelQueries(); query.clear(); await query.invalidateQueries(); })} />
  </View>;
}
