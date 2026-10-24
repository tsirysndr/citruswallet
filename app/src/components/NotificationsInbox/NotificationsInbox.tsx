import { ContentSkeleton } from "../ContentSkeleton";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "../Typography";
import { BellIcon } from "../BellIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { request } from "../../api";
import { useAction, useSession } from "../../hooks";
import { type Notice } from "../../notifications";
import { reviewAtom, screenAtom } from "../../state";
import { Button, Empty, Heading } from "../ui";
export function NotificationsInbox() {
  const [open, setOpen] = useState(false),
    { data: session } = useSession(),
    query = useQueryClient(),
    run = useAction();
  const review = useSetAtom(reviewAtom),
    screen = useSetAtom(screenAtom);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["notifications", session?.did],
    enabled: !!session?.did,
    queryFn: () =>
      request<{ notifications: Notice[]; unread: number }>("listNotifications"),
  });
  if (!session?.did) return null;
  return (
    <>
      <Pressable
        accessibilityLabel={`Notifications, ${data?.unread || 0} unread`}
        onPress={() => setOpen(true)}
        className="p-2"
      >
        <BellIcon size={24} />
        {!!data?.unread && (
          <View className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue" />
        )}
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet"
      >
        <View className="flex-1 bg-canvas px-5 pb-8 pt-14">
          <View className="flex-row justify-between">
            <Heading title="Notifications" />
            <Button title="Close" tone="ghost" onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingTop: 20 }}>
            {isPending && <ContentSkeleton label="Loading notifications" />}
            {error && (
              <Button
                title="Could not load notifications. Retry"
                tone="ghost"
                onPress={() => void refetch()}
              />
            )}
            {data?.notifications.map((item) => (
              <Pressable
                key={item.id}
                className="gap-2 rounded-2xl bg-surface p-5"
                onPress={() =>
                  run(async () => {
                    await request("markNotificationRead", { id: item.id });
                    await query.invalidateQueries({
                      queryKey: ["notifications"],
                    });
                    review(item.paymentId);
                    screen("Payments");
                    setOpen(false);
                  })
                }
              >
                <Text className="text-base font-semibold">
                  {item.read ? "" : "● "}Payment received
                </Text>
                <Text className="text-sm text-muted">
                  {new Date(Number(item.createdAt)).toLocaleString()}
                </Text>
                <Text className="text-sm">View payment →</Text>
              </Pressable>
            ))}
            {!isPending && !error && !data?.notifications.length && (
              <Empty text="Your confirmed incoming payments will appear here." />
            )}
            <Button
              title="Mark all as read"
              tone="ghost"
              disabled={!data?.unread}
              onPress={() =>
                run(async () => {
                  await request("markAllNotificationsRead", {});
                  await query.invalidateQueries({
                    queryKey: ["notifications"],
                  });
                })
              }
            />
            <Button
              title="Notification settings"
              tone="ghost"
              onPress={() => {
                setOpen(false);
                screen("Settings");
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
