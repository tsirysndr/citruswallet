import { NetworkSettings } from "../components/NetworkSettings";
import { LocalWallet } from "../components/LocalWallet";
import { nativeVaultState, subscribeNativeVault } from "../local-wallet";
import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Text } from "../components/Typography";
import * as Clipboard from "expo-clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { request } from "../api";
import { useAction, useSession } from "../hooks";
import { linkWallet } from "../wallet";
import { Button, Empty, Heading } from "../components/ui";
export function Wallet() {
  const { data: session } = useSession(),
    query = useQueryClient(),
    run = useAction();
  const [isPublic, setPublic] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const vault = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const [external, setExternal] = useState(false);
  useEffect(() => { void SecureStore.getItemAsync("citrus-wallet-mode").then(mode => setExternal(mode === "metamask")); }, []);
  const builtIn = ["locked", "unlocked"].includes(vault) && !external;
  if (!session?.did)
    return <View className="gap-5"><LocalWallet /><Empty text="Sign in from Account to link a wallet." /></View>;
  return (
    <View className="gap-5">
      <LocalWallet />
      {["locked", "unlocked"].includes(vault) && <Button title={external ? "Use Citrus wallet" : "Use MetaMask instead (optional)"} tone="plain" onPress={() => run(async () => { await SecureStore.setItemAsync("citrus-wallet-mode", external ? "citrus" : "metamask"); setExternal(!external); })} />}
      <Heading
        title="Your wallets"
        subtitle="Link your wallet to your Atmosphere account. Linking does not move funds."
      />
      <View className="flex-row items-center gap-3">
        <ThemeSwitch
          accessibilityLabel="Public receiving address"
          value={isPublic}
          onValueChange={setPublic}
        />
        <Text className="flex-1 text-base">
          Publish as a receiving address on AT Protocol
        </Text>
      </View>
      <Button
        title={connecting ? "Linking…" : builtIn ? "Link Citrus wallet" : "Connect & link MetaMask"}
        disabled={builtIn && vault !== "unlocked"}
        onPress={() =>
          run(async () => {
            setConnecting(true);
            try {
              await linkWallet(session.network, isPublic);
              await query.invalidateQueries();
            } finally {
              setConnecting(false);
            }
          })
        }
      />
      {!builtIn && <Button
        title="Get the MetaMask app"
        tone="plain"
        onPress={() => void Linking.openURL("https://metamask.io/download/")}
      />}
      <NetworkSettings />
      {session.links.length === 0 && <Empty text="No linked wallets yet." />}
      {session.links.map((link) => (
        <View
          key={`${link.chain_id}:${link.address}`}
          className="gap-4 rounded-3xl bg-white p-5"
        >
          <Text selectable className="font-mono text-sm">
            {link.address}
          </Text>
          <Text className="text-sm text-muted">
            {link.public ? "Public" : "Private"} · Chain {link.chain_id}
            {link.is_default ? " · Default" : ""}
          </Text>
          <View className="gap-2">
            <Button
              title="Copy address"
              tone="plain"
              onPress={() =>
                run(async () => {
                  await Clipboard.setStringAsync(link.address);
                })
              }
            />
            {link.public && !link.is_default && (
              <Button
                title="Use for receiving"
                onPress={() =>
                  run(async () => {
                    await request("setDefaultAddress", {
                      address: link.address,
                    });
                    await query.invalidateQueries();
                  })
                }
              />
            )}
            <Button
              title="Unlink wallet"
              tone="plain"
              onPress={() =>
                Alert.alert(
                  "Unlink wallet?",
                  "This removes the link, not your funds.",
                  [
                    { text: "Keep wallet", style: "cancel" },
                    {
                      text: "Unlink",
                      style: "destructive",
                      onPress: () =>
                        run(async () => {
                          await request("unlinkAddress", {
                            address: link.address,
                          });
                          await query.invalidateQueries();
                        }),
                    },
                  ],
                )
              }
            />
          </View>
        </View>
      ))}
    </View>
  );
}
