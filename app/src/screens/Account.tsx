import { IdentitySheet } from "../components/IdentitySheet";
import { walletMode } from "../wallet-preferences";
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInForm } from '../validation';
import { requestUnlock } from "../wallet-unlock";
import { nativeBalanceAddress, nativeVaultState, subscribeNativeVault } from "../local-wallet";
import { deviceNetwork } from "../network";
import { AssetBalances } from "../components/AssetBalances";
import { ContentSkeleton } from "../components/ContentSkeleton";
import { Ionicons } from "@expo/vector-icons";
import { useState, useSyncExternalStore } from "react";
import { Linking, Pressable, View } from "react-native";
import { Text } from "../components/Typography";
import { useSetAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signIn } from "../auth";
import { useAction, useProfile, useSession } from "../hooks";
import { screenAtom, walletSetupAtom } from "../state";
import { formatWei } from "../amount";
import { Button, Heading } from "../components/ui";
import { HandleInput } from "../components/HandleInput";
import { AtmosphereApps } from "../components/AtmosphereApps";
import { WalletAction } from "../components/WalletAction";
export function Account() {
  const { data: session } = useSession(),
    { data: profile } = useProfile();
  const form = useForm({ resolver: zodResolver(signInForm), defaultValues: { identifier: '' } });
  const { field } = useController({ control: form.control, name: 'identifier' });
  const handle = field.value, setHandle = field.onChange;
  const [hidden, setHidden] = useState(false);
  const [explain, setExplain] = useState(false);
  const run = useAction(),
    query = useQueryClient(),
    go = useSetAtom(screenAtom);
  const setup = useSetAtom(walletSetupAtom);
  const localAddress = useSyncExternalStore(subscribeNativeVault, nativeBalanceAddress);
  const vaultState = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const addresses = [...new Set([
    ...(session?.links.filter(l => l.chain_id === session.network.chainId).map(l => l.address.toLowerCase()) ?? []),
    ...(localAddress ? [localAddress.toLowerCase()] : []),
  ])];
  const walletLocked = vaultState === 'locked' && walletMode() !== 'metamask';
  const needsUnlock = addresses.length === 0 && vaultState !== 'absent' && !localAddress;
  const { data: balance, isFetching: balanceLoading, isError: balanceFailed } = useQuery({
    queryKey: ["balance", session?.did, session?.network.chainId, addresses],
    enabled:
      !!session?.did && !needsUnlock,
    queryFn: async () => {
      let total = 0n;
      for (const address of addresses) {
        const response = await fetch(
          deviceNetwork(session!.network).rpcUrls?.[0] || "https://ethereum-rpc.publicnode.com",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_getBalance",
              params: [address, "latest"],
            }),
          },
        );
        const data = await response.json();
        if (!response.ok || typeof data.result !== "string" || !/^0x[0-9a-f]+$/i.test(data.result))
          throw new Error("Balance unavailable");
        total += BigInt(data.result);
      }
      return formatWei(total);
    },
    staleTime: 30000,
  });
  if (!session?.did)
    return (
      <View className="gap-6">
        <Heading
          title="Your handle. Your wallet."
          subtitle="Send assets to the people you know. Your keys stay with you."
        />
        <View className="gap-5 rounded-3xl bg-white p-6">
          <Heading title="Welcome to Peachlet" />
          <Text className="my-1 text-center text-base leading-6 text-muted">Sign in with your Atmosphere Account</Text>
          <AtmosphereApps />
          <View className="gap-3"><Pressable accessibilityRole="button" accessibilityState={{ expanded: explain }} onPress={() => setExplain(!explain)}><Text className="text-center text-sm leading-6 text-muted underline">What is an Atmosphere Account?</Text></Pressable>{explain && <Text className="text-center text-sm leading-6 text-muted">An account on the AT Protocol network, such as Bluesky or selfhosted.social. Use the same handle you already have.</Text>}</View>
          <HandleInput value={handle} onChange={setHandle} onSubmit={form.handleSubmit(({ identifier }) => run(async () => { if (await signIn(identifier)) await query.invalidateQueries(); }))} />
          {form.formState.errors.identifier && <Text accessibilityRole="alert" className="text-red-700">{form.formState.errors.identifier.message}</Text>}
          <Button
            title="Sign In"
            tone="black"
            disabled={!handle.trim()}
            onPress={form.handleSubmit(({ identifier }) => run(async () => { if (await signIn(identifier)) await query.invalidateQueries(); }))}
          />
          <Text className="text-sm text-muted">
            Don't have an account?{" "}
            <Text accessibilityRole="link" className="text-sm underline"
              onPress={() => run(async () => { if (await signIn("", true)) await query.invalidateQueries(); })}>Create one</Text>
          </Text>
          <Text className="text-sm leading-6 text-muted">
            By continuing, you agree to the Terms and Conditions and Privacy
            Policy.
          </Text>
          <View className="flex-row gap-4">
            <Text
              onPress={() =>
                void Linking.openURL("https://peachlet.app/terms")
              }
              className="text-sm underline"
            >
              Terms
            </Text>
            <Text
              onPress={() =>
                void Linking.openURL("https://peachlet.app/privacy")
              }
              className="text-sm underline"
            >
              Privacy
            </Text>
          </View>
        </View>
      </View>
    );
  return (
    <View className="gap-5">
      <View className="flex-row items-center justify-between">
        <Heading
          title={`Hello, ${profile?.displayName?.split(" ")[0] || "there"}.`}
        />
        <IdentitySheet />
      </View>
      <View className="gap-4 rounded-3xl bg-ink p-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg text-white">ETH balance</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
            onPress={() => setHidden(!hidden)} hitSlop={8}
            className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={28} color="#ffffff" />
          </Pressable>
        </View>
        {balanceLoading && balance === undefined && !hidden ? <ContentSkeleton variant="line" label="Loading balance" inverse /> : <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          className="font-mono text-4xl font-bold text-white"
        >
          {hidden ? "•••••• ETH" : needsUnlock ? "Unlock to load balance" : balanceFailed ? "Balance unavailable" : balance !== undefined ? `${balance} ETH` : "Loading balance…"}
        </Text>}
        {walletLocked && <Button title="Unlock wallet" tone="plain" onPress={() => run(async () => {
          await requestUnlock();
          await Promise.all([
            query.invalidateQueries({ queryKey: ['balance'] }),
            query.invalidateQueries({ queryKey: ['assets'] }),
          ]);
        })} />}
        {!hidden && balanceFailed && <Pressable accessibilityRole="button" accessibilityLabel="Retry balance" onPress={() => void query.invalidateQueries({ queryKey: ['balance'] })}><Text className="text-sm text-white underline">Try again</Text></Pressable>}
        <Text className="text-sm text-accent">● {session.network.name}</Text>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <WalletAction action="link" onPress={() => { setup(true); go("Wallet"); }} />
        </View>
        <View className="flex-1">
          <WalletAction action="send" onPress={() => go("Payments")} />
        </View>
      </View>
      <AssetBalances session={session} hidden={hidden} />
      <Button
        title="View activity"
        tone="plain"
        onPress={() => go("Activity")}
      />
    </View>
  );
}
