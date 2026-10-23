import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { request } from "../api";
import { useAction, useSession } from "../hooks";
import { reviewAtom, screenAtom } from "../state";
import type { Payment } from "../types";
import { Avatar, Button, Empty, Field, Heading } from "../components/ui";
export function Activity() {
  const { data: session } = useSession(),
    run = useAction(),
    client = useQueryClient();
  const [text, setText] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState(false);
  const [direction, setDirection] = useState("all"),
    [status, setStatus] = useState("all"),
    [days, setDays] = useState(90);
  const review = useSetAtom(reviewAtom),
    go = useSetAtom(screenAtom);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [text]);
  const [now] = useState(() => Date.now());
  const params = {
    q: q || undefined,
    page,
    pageSize: 20,
    direction,
    status,
    after: days ? String(now - days * 86400000) : undefined,
  };
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["activity", session?.did, params],
    enabled: !!session?.did,
    queryFn: () =>
      request<{ payments: Payment[]; total: number }>(
        "listPayments",
        undefined,
        params,
      ),
  });
  if (!session?.did)
    return <Empty text="Sign in from Account to see your activity." />;
  return (
    <View className="gap-5">
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
            value={text}
            onChangeText={setText}
            placeholder="Name, handle, description…"
          />
        </View>
        <Pressable
          accessibilityLabel="Activity filters"
          onPress={() => setFilters(true)}
          className="rounded-lg bg-white p-4"
        >
          <Ionicons name="options-outline" size={24} />
        </Pressable>
      </View>
      <Text className="text-sm text-muted">
        {isFetching ? "Searching…" : `${data?.total ?? 0} payments`}
      </Text>
      {error ? (
        <Button title="Search failed. Retry" onPress={() => void refetch()} />
      ) : !isFetching && !data?.payments.length ? (
        <Empty text="No payments found." />
      ) : null}
      {data?.payments.map((payment) => {
        const outgoing = payment.senderDid === session.did,
          actor = outgoing ? payment.recipient : payment.sender;
        return (
          <View key={payment.id} className="gap-3 rounded-2xl bg-white p-4">
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
              <Text className="text-xl font-bold">{payment.amount} ETH</Text>
              <Text className="text-sm text-muted">{payment.state}</Text>
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
      })}
      <View className="flex-row items-center justify-between">
        <Button
          title="Previous"
          disabled={page === 1 || isFetching}
          tone="plain"
          onPress={() => setPage((p) => p - 1)}
        />
        <Text>
          {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}
        </Text>
        <Button
          title="Next"
          disabled={page * 20 >= (data?.total ?? 0) || isFetching}
          tone="plain"
          onPress={() => setPage((p) => p + 1)}
        />
      </View>
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
                    setPage(1);
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
                    setPage(1);
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
                    setPage(1);
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
