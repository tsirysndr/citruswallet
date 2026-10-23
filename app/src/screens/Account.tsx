import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Text } from "../components/Typography";
import { useSetAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, saveToken } from "../api";
import { signIn } from "../auth";
import { useAction, useProfile, useSession } from "../hooks";
import { screenAtom } from "../state";
import { formatWei } from "../amount";
import { Avatar, Button, Heading } from "../components/ui";
import { HandleInput } from "../components/HandleInput";
import { WalletAction } from "../components/WalletAction";
export function Account() {
  const { data: session } = useSession(),
    { data: profile } = useProfile();
  const [handle, setHandle] = useState(""),
    [hidden, setHidden] = useState(false);
  const run = useAction(),
    query = useQueryClient(),
    go = useSetAtom(screenAtom);
  const addresses =
    session?.links
      .filter((l) => l.chain_id === session.network.chainId)
      .map((l) => l.address) ?? [];
  const { data: balance } = useQuery({
    queryKey: ["balance", session?.did, addresses],
    enabled:
      !!session?.did && addresses.length > 0 && session.network.chainId === 1,
    queryFn: async () => {
      let total = 0n;
      for (const address of addresses) {
        const response = await fetch(
          process.env.EXPO_PUBLIC_ETH_RPC_URL || "https://eth.drpc.org",
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
        if (!response.ok || typeof data.result !== "string")
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
          subtitle="Send ETH to the people you know. Your keys stay in MetaMask."
        />
        <View className="gap-5 rounded-3xl bg-white p-6">
          <Heading title="Welcome to Citrus" />
          <HandleInput value={handle} onChange={setHandle} />
          <Button
            title="Sign in with AT Protocol"
            tone="black"
            disabled={!handle.trim()}
            onPress={() =>
              run(async () => {
                if (await signIn(handle)) await query.invalidateQueries();
              })
            }
          />
          <Text className="text-sm leading-6 text-muted">
            By continuing, you agree to the Terms and Conditions and Privacy
            Policy.
          </Text>
          <View className="flex-row gap-4">
            <Text
              onPress={() =>
                void Linking.openURL("https://citruswallet.app/terms")
              }
              className="text-sm underline"
            >
              Terms
            </Text>
            <Text
              onPress={() =>
                void Linking.openURL("https://citruswallet.app/privacy")
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
        <Avatar actor={profile} />
      </View>
      <View className="gap-4 rounded-3xl bg-ink p-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg text-white">Your balance</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
            onPress={() => setHidden(!hidden)} hitSlop={8}
            className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={28} color="#ffffff" />
          </Pressable>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          className="font-mono text-4xl font-semibold text-white"
        >
          {hidden ? "••••••" : (balance ?? "—")} ETH
        </Text>
        <Text className="text-sm text-accent">● {session.network.name}</Text>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <WalletAction action="link" onPress={() => go("Wallet")} />
        </View>
        <View className="flex-1">
          <WalletAction action="send" onPress={() => go("Payments")} />
        </View>
      </View>
      <View className="gap-4 rounded-3xl bg-white p-5">
        <Text className="text-xl font-semibold">Your identity</Text>
        <View className="flex-row items-center gap-3">
          <Avatar actor={profile} />
          <View className="flex-1">
            <Text className="text-lg font-semibold">
              {profile?.displayName || profile?.handle || "Connected"}
            </Text>
            <Text className="text-sm text-muted">
              @{profile?.handle || "…"}
            </Text>
          </View>
        </View>
        <Text selectable className="text-xs text-muted">
          {session.did}
        </Text>
        <Button
          title="Sign out"
          tone="plain"
          onPress={() =>
            run(async () => {
              await request("logout", {});
              await saveToken(null);
              await query.resetQueries();
            })
          }
        />
      </View>
      <Button
        title="View activity"
        tone="plain"
        onPress={() => go("Activity")}
      />
    </View>
  );
}
