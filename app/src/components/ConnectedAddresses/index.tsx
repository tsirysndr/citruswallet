import { Alert, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { request } from '../../api';
import { useAction, useSession } from '../../hooks';
import { Text } from '../Typography';
import { Button, Empty } from '../ui';
export function ConnectedAddresses() {
  const { data: session } = useSession(), query = useQueryClient(), run = useAction();
  if (!session?.did) return <Empty text="Sign in to manage your receiving addresses." />;
  return <View className="gap-4">
      {session.links.length === 0 && <Empty text="No linked wallets yet." />}
      {session.links.map((link) => (
        <View
          key={`${link.chain_id}:${link.address}`}
          className="gap-4 rounded-3xl bg-surface p-5"
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
</View>;
}
