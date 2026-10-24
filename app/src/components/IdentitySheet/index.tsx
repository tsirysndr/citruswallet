import { useTheme } from "../../theme";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import X from "lucide-react-native/icons/x";
import { useQueryClient } from "@tanstack/react-query";
import { useAction, useProfile, useSession } from "../../hooks";
import { request, saveToken } from "../../api";
import { Text } from "../Typography";
import { Avatar, Button } from "../ui";
import { ContentSkeleton } from "../ContentSkeleton";
export function IdentitySheet() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const { data: session } = useSession(),
    { data: profile, isFetching } = useProfile();
  const run = useAction(),
    query = useQueryClient();
  if (!session?.did) return null;
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account information"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
      >
        <Avatar actor={profile} size={48} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss account information"
            onPress={close}
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.2)",
            }}
          />
          <SafeAreaView
            edges={["bottom"]}
            accessibilityViewIsModal
            className="rounded-t-3xl bg-surface"
            style={{ maxHeight: "75%" }}
          >
            <View className="items-center pt-3">
              <View className="h-1 w-10 rounded-full bg-edge" />
            </View>
            <View className="flex-row items-center justify-between px-5 pt-3">
              <Text accessibilityRole="header" className="text-xl font-bold">
                Your identity
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close account information"
                onPress={close}
                className="h-12 w-12 items-center justify-center"
              >
                <X size={24} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 18 }}
              keyboardShouldPersistTaps="handled"
            >
              {isFetching && !profile ? (
                <ContentSkeleton rows={1} label="Loading profile" />
              ) : (
                <View className="flex-row items-center gap-3">
                  <Avatar actor={profile} size={56} />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-lg font-bold">
                      {profile?.displayName || profile?.handle || "Connected"}
                    </Text>
                    <Text selectable className="font-mono text-sm text-muted">
                      {profile?.handle
                        ? `@${profile.handle}`
                        : "Handle unavailable"}
                    </Text>
                  </View>
                </View>
              )}
              <View className="gap-2">
                <Text className="text-sm text-muted">Authenticated DID</Text>
                <Text selectable className="font-mono text-sm">
                  {session.did}
                </Text>
              </View>
              <Button
                title="Sign out"
                tone="ghost"
                onPress={() =>
                  run(async () => {
                    await request("logout", {});
                    await saveToken(null);
                    close();
                    await query.resetQueries();
                  })
                }
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
