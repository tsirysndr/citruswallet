import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInForm } from '../../validation';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { signIn } from '../../auth';
import { useAction } from '../../hooks';
import { Text } from '../Typography';
import { HandleInput } from '../HandleInput';
import { AtmosphereApps } from '../AtmosphereApps';
import { Button } from '../ui';

export function OnboardingSignIn() {
  const [explain, setExplain] = useState(false);
  const form = useForm({ resolver: zodResolver(signInForm), defaultValues: { identifier: '' } });
  const run = useAction(), query = useQueryClient();
  const start = (identifier: string, create = false) => run(async () => {
    if (await signIn(identifier, create)) await query.invalidateQueries();
  });
  const submit = form.handleSubmit(({ identifier }) => start(identifier));
  return <View className="gap-5 rounded-3xl bg-white p-6">
    <Text className="text-center text-3xl font-semibold">Your handle. Your wallet.</Text>
    <Text className="text-center text-base leading-6 text-muted">One last step: sign in with your Atmosphere account. Send and receive crypto using an @handle instead of a long wallet address.</Text>
    <Text className="text-center text-sm leading-6 text-muted">We’ll link your wallet to your account so friends can pay you by handle. Your keys stay on your device.</Text>
    <AtmosphereApps />
    <Controller control={form.control} name="identifier" render={({ field }) => <HandleInput value={field.value} onChange={field.onChange} onSubmit={submit} />} />
    {form.formState.errors.identifier && <Text accessibilityRole="alert" className="text-sm text-red-700">{form.formState.errors.identifier.message}</Text>}
    <Button title="Sign In" tone="black" disabled={!form.watch('identifier').trim()} onPress={submit} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: explain }} onPress={() => setExplain(!explain)}><Text className="text-sm text-muted underline">What is an Atmosphere account?</Text></Pressable>
    {explain && <Text className="text-sm leading-6 text-muted">An account on the AT Protocol network, such as Bluesky or selfhosted.social. Use the same handle you already have.</Text>}
    <Text className="text-sm text-muted">Don’t have an account? <Text accessibilityRole="link" className="underline" onPress={() => start('', true)}>Create one</Text></Text>
    <Text className="text-sm leading-6 text-muted">By continuing, you agree to our <Text accessibilityRole="link" className="underline" onPress={() => void Linking.openURL('https://citruswallet.app/terms')}>Terms</Text> and <Text accessibilityRole="link" className="underline" onPress={() => void Linking.openURL('https://citruswallet.app/privacy')}>Privacy Policy</Text>. You’ll sign in securely with your account provider.</Text>
  </View>;
}
