import { ContentSkeleton } from "../components/ContentSkeleton";
import Svg, { Circle, Path } from "react-native-svg";
import { PaymentStatus } from "../components/PaymentStatus";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshControl, Alert, FlatList, Modal, Pressable, View } from "react-native";
import { Text } from "../components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { request } from "../api";
import { useAction, useSession } from "../hooks";
import { reviewAtom, screenAtom } from "../state";
import type { Payment } from "../types";
import { Avatar, Button, Empty, Field, Heading } from "../components/ui";
export function Activity({ header }: { header?: ReactNode }) {
  const list = useRef<FlatList<Payment>>(null);
  const { data: session } = useSession(),
    run = useAction(),
    client = useQueryClient();
  const [text, setText] = useState(""),
    [q, setQ] = useState(""),
    [filters, setFilters] = useState(false);
  const [direction, setDirection] = useState("all"),
    [status, setStatus] = useState("all"),
    [days, setDays] = useState(90);
  const review = useSetAtom(reviewAtom),
    go = useSetAtom(screenAtom);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [text]);
  const [now] = useState(() => Date.now());
  const params = {
    q: q || undefined,
    pageSize: 20,
    direction,
    status,
    after: days ? String(now - days * 86400000) : undefined,
  };
  const { data, isFetching, isPending, isFetchingNextPage, isFetchNextPageError, hasNextPage, fetchNextPage, error, refetch } = useInfiniteQuery({
    queryKey: ["activity", session?.did, session?.network.chainId, params],
    enabled: !!session?.did,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => request<{ payments: Payment[]; total: number }>("listPayments", undefined, { ...params, page: pageParam }),
    getNextPageParam: (last, _pages, page) => last.payments.length > 0 && page * 20 < last.total ? page + 1 : undefined,
  });
  const payments = data?.pages.flatMap(page => page.payments).filter((payment, index, items) => items.findIndex(item => item.id === payment.id) === index) || [];
  useEffect(() => { list.current?.scrollToOffset({ offset: 0, animated: false }); }, [q, direction, status, days]);
  if (!session?.did)
    return <Empty text="Sign in from Account to see your activity." />;
  return (
    <View className="flex-1">
      <FlatList ref={list} accessibilityLabel="Activity payments" data={payments} keyExtractor={payment => payment.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isFetching && !isFetchingNextPage && !isPending} onRefresh={() => void refetch()} colors={["transparent"]} tintColor="transparent" progressBackgroundColor="transparent" />}
        onEndReachedThreshold={0.5} onEndReached={() => {
          if (hasNextPage && !isFetching && !error && q === text.trim()) void fetchNextPage();
        }}
        ListHeaderComponent={<View className="gap-5 pb-4">{header}
          {isFetching && !isPending && !isFetchingNextPage && <ContentSkeleton label="Refreshing activity" rows={1} />}
      <View className="flex-row items-center justify-between">
        <Heading title="Activity" />
        <Pressable
          accessibilityLabel="Refresh activity"
          onPress={() => void refetch()}
          className="p-3"
        >
          <Ionicons name="refresh-outline" size={24} />
        </Pressable>
      </View>
      <View className="flex-row items-end gap-3">
        <View className="flex-1">
          <Field
            label="Search payments"
            style={{ height: 48 }}
            value={text}
            onChangeText={setText}
            placeholder="Name, handle, description…"
          />
        </View>
        <Pressable
          accessibilityLabel="Activity filters"
          onPress={() => setFilters(true)}
          className="items-center justify-center rounded-lg bg-white"
          style={{ width: 48, height: 48 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#191916" strokeWidth={1.6} strokeLinecap="round" accessible={false}>
            <Path d="M3 7h3m6 0h9M3 17h9m6 0h3" />
            <Circle cx={9} cy={7} r={3} />
            <Circle cx={15} cy={17} r={3} />
          </Svg>
        </Pressable>
      </View>
      <Text className="text-sm text-muted">
        {isPending ? "Searching…" : `${data?.pages[0]?.total ?? 0} payments`}
      </Text>
        </View>}
        ListEmptyComponent={error ? <Button title="Search failed. Retry" onPress={() => void refetch()} /> :
          !isPending ? <Empty text="No payments found." /> : <ContentSkeleton label="Loading payments" />}
        ListFooterComponent={<View className="py-4">
          {isFetchingNextPage && <ContentSkeleton label="Loading more payments" rows={1} />}
          {isFetchNextPageError && <Button title="Could not load more. Retry" onPress={() => void fetchNextPage()} />}
          {!hasNextPage && payments.length > 0 && !isFetching && <Text className="text-center text-sm text-muted">You're all caught up.</Text>}
        </View>}
        renderItem={({ item: payment }) => {
        const outgoing = payment.senderDid === session.did,
          actor = outgoing ? payment.recipient : payment.sender;
        return (
          <View className="mb-3 gap-3 rounded-2xl bg-white p-4">
            <View className="flex-row items-center gap-3">
              <Avatar actor={actor} />
              <View className="flex-1">
                <Text className="text-base font-semibold">
                  {outgoing ? "To" : "From"}{" "}
                  {actor?.displayName ||
                    actor?.handle ||
                    payment.recipientLabel}
                </Text>
                {actor?.handle && (
                  <Text className="text-sm text-muted">@{actor.handle}</Text>
                )}
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold">{payment.amount} {payment.asset}</Text>
              <PaymentStatus state={payment.state} />
            </View>
            {payment.description && (
              <Text numberOfLines={2} className="text-sm">
                {payment.description}
              </Text>
            )}
            <Text className="text-xs text-muted">
              {new Date(payment.createdAt).toLocaleString()}
            </Text>
            <Button
              title="View payment"
              tone="plain"
              onPress={() => {
                review(payment.id);
                go("Payments");
              }}
            />
            {outgoing && payment.state === "cancelled" && (
              <Button
                title="Delete cancelled intent"
                tone="plain"
                onPress={() =>
                  Alert.alert(
                    "Delete cancelled intent?",
                    "This removes it from your activity.",
                    [
                      { text: "Keep", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          run(async () => {
                            await request("deletePayment", { id: payment.id });
                            await client.invalidateQueries();
                          }),
                      },
                    ],
                  )
                }
              />
            )}
          </View>
        );
      }} />
      <Modal
        visible={filters}
        transparent
        animationType="slide"
        onRequestClose={() => setFilters(false)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <View className="gap-4 rounded-t-3xl bg-canvas px-6 pb-10 pt-6">
            <Heading title="Filter activity" />
            <Text>Transaction type</Text>
            <View className="flex-row flex-wrap gap-2">
              {["all", "sent", "received"].map((value) => (
                <Button
                  key={value}
                  title={value}
                  tone={direction === value ? "lime" : "plain"}
                  onPress={() => {
                    setDirection(value);
                                }}
                />
              ))}
            </View>
            <Text>Status</Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                "all",
                "waiting",
                "ready",
                "prepared",
                "submitted",
                "confirming",
                "confirmed",
                "failed",
                "cancelled",
                "expired",
              ].map((value) => (
                <Button
                  key={value}
                  title={value}
                  tone={status === value ? "lime" : "plain"}
                  onPress={() => {
                    setStatus(value);
                                }}
                />
              ))}
            </View>
            <Text>Date range</Text>
            <View className="flex-row flex-wrap gap-2">
              {[30, 90, 365, 0].map((value) => (
                <Button
                  key={value}
                  title={value ? `Last ${value} days` : "All time"}
                  tone={days === value ? "lime" : "plain"}
                  onPress={() => {
                    setDays(value);
                                }}
                />
              ))}
            </View>
            <Button
              title="Show results"
              tone="dark"
              onPress={() => setFilters(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
