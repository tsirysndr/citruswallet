import { useState } from "react";
import { Alert, Linking, Switch, Text, View } from "react-native";
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
  if (!session?.did)
    return <Empty text="Sign in from Account to link a wallet." />;
  return (
    <View className="gap-5">
      <Heading
        title="Your wallets"
        subtitle="Connect with the MetaMask app. Signing proves ownership; it does not move funds."
      />
      <View className="flex-row items-center gap-3">
        <Switch
          accessibilityLabel="Public receiving address"
          value={isPublic}
          onValueChange={setPublic}
        />
        <Text className="flex-1 text-base">
          Publish as a receiving address on AT Protocol
        </Text>
      </View>
      <Button
        title="Connect & link MetaMask"
        onPress={() =>
          run(async () => {
            await linkWallet(session.network, isPublic);
            await query.invalidateQueries();
          })
        }
      />
      <Button
        title="Get the MetaMask app"
        tone="plain"
        onPress={() => void Linking.openURL("https://metamask.io/download/")}
      />
      {session.links.length === 0 && <Empty text="No linked wallets yet." />}
      {session.links.map((link) => (
        <View
          key={`${link.chain_id}:${link.address}`}
          className="gap-4 rounded-3xl bg-white p-5"
        >
          <Text selectable className="text-sm">
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
