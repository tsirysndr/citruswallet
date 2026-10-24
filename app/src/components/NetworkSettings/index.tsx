import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { reviewAtom } from '../../state';
import { useAction, useSession } from '../../hooks';
import { currentRpc, saveNetwork, selectedChain } from '../../network';
import { networkForm } from '../../validation';
import { lockNativeWallet } from '../../local-wallet';
import { Button, Heading } from '../ui';
import { FormField } from '../FormField';
import { Text } from '../Typography';
export function NetworkSettings() {
  const { data: session } = useSession();
  const form = useForm({ resolver: zodResolver(networkForm), defaultValues: { chain: (selectedChain() || String(session?.network.chainId || 4326)) as '1' | '4326' | '6343', rpc: currentRpc() } });
  const chain = form.watch('chain');
  const choose = (value: '1' | '4326' | '6343') => { form.setValue('chain', value); form.setValue('rpc', ''); form.clearErrors(); };
  const run = useAction(), query = useQueryClient(), setReview = useSetAtom(reviewAtom);
  const save = form.handleSubmit(({ chain, rpc }) => run(async () => { await saveNetwork(chain, rpc); lockNativeWallet(); setReview(null); await query.cancelQueries(); query.clear(); await query.invalidateQueries(); }));
  return <View className="gap-4 rounded-3xl bg-white p-5"><Heading title="Network" subtitle="Switching networks does not move your funds." />
    <Button title={`MegaETH${chain === '4326' ? ' · selected' : ''}`} tone={chain === '4326' ? undefined : 'plain'} onPress={() => choose('4326')} />
    <Button title={`Ethereum mainnet${chain === '1' ? ' · selected' : ''}`} tone={chain === '1' ? undefined : 'plain'} onPress={() => choose('1')} />
    <Button title={`MegaETH testnet${chain === '6343' ? ' · selected' : ''}`} tone={chain === '6343' ? undefined : 'plain'} onPress={() => choose('6343')} />
    {chain === '6343' && <Text>For testing only. Testnet ETH has no real value.</Text>}
    <FormField control={form.control} name="rpc" label="Custom HTTPS RPC (optional)" autoCapitalize="none" autoCorrect={false} keyboardType="url" onSubmitEditing={save} />
    {form.formState.errors.chain && <Text accessibilityRole="alert">{form.formState.errors.chain.message}</Text>}
    <Text>Your RPC provider can see your address and transactions. Citrus verifies payments independently.</Text>
    <Button title="Save network" onPress={save} />
  </View>;
}
