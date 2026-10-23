import { useEffect, useState } from "react";
import { Alert, Share, Switch, Text, View } from "react-native";
import { useAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../api";
import { useAction, useSession } from "../hooks";
import { reviewAtom } from "../state";
import { amountWei } from "../amount";
import { pending, recover, sendPayment } from "../wallet";
import type { Actor, Payment, Recipient } from "../types";
import { Avatar, Button, Empty, Field, Heading } from "../components/ui";
import { AmountPad } from "../components/AmountPad";
export function Payments() {
  const { data: session } = useSession(),
    query = useQueryClient(),
    run = useAction();
  const [id, setId] = useAtom(reviewAtom),
    [handle, setHandle] = useState(""),
    [amount, setAmount] = useState("0"),
    [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null),
    [ack, setAck] = useState(false),
    [hash, setHash] = useState(""),
    [hasPending, setPending] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(handle.trim()), 250);
    return () => clearTimeout(timer);
  }, [handle]);
  const { data: suggestions } = useQuery({
    queryKey: ["actors", search],
    enabled: !!session?.did && search.length > 1 && !recipient,
    queryFn: () =>
      request<{ actors: Actor[] }>("searchActors", undefined, { q: search }),
  });
  const { data: detail, isFetching } = useQuery({
    queryKey: ["payment", session?.did, id],
    enabled: !!id && !!session?.did,
    queryFn: () =>
      request<{ payment: Payment }>("getPayment", undefined, { id: id! }),
  });
  const payment = detail?.payment;
  useEffect(
    () => setAck(false),
    [payment?.id, payment?.revision, payment?.address],
  );
  useEffect(() => {
    if (session?.did)
      void pending(session.did).then((value) => setPending(!!value));
  }, [session?.did, payment]);
  if (!session?.did)
    return <Empty text="Sign in from Account to send a payment." />;
  const reload = async () => {
    await query.invalidateQueries();
    setPending(!!(await pending(session.did!)));
  };
  const resolve = () =>
    run(async () => {
      const result = await request<Recipient>("resolveRecipient", {
        identifier: handle,
      });
      if (result.did === session.did)
        throw new Error("You cannot send ETH to yourself.");
      setRecipient(result);
    });
  return (
    <View className="gap-5">
      <Heading
        title={id ? "Review payment" : "Send ETH"}
        subtitle={
          id
            ? "Check every detail before opening MetaMask."
            : "Pay someone by their AT Protocol handle."
        }
      />
      {hasPending && (
        <View className="gap-3 rounded-2xl bg-peach p-4">
          <Text className="text-base">
            A previous wallet request needs recovery. Check MetaMask before
            sending again.
          </Text>
          <Field
            label="Original transaction hash (if needed)"
            value={hash}
            onChangeText={setHash}
            autoCapitalize="none"
          />
          <Button
            title="Recover transaction"
            onPress={() =>
              run(async () => {
                await recover(session.did!, hash || undefined);
                await reload();
              })
            }
          />
        </View>
      )}
      {!id ? (
        <>
          <Field
            label="Recipient handle"
            value={handle}
            onChangeText={(text) => {
              setHandle(text);
              setRecipient(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="friend.bsky.social"
          />
          {!recipient &&
            suggestions?.actors
              .filter((actor) => actor.did !== session.did)
              .slice(0, 5)
              .map((actor) => (
                <Button
                  key={actor.did}
                  title={`@${actor.handle}`}
                  tone="plain"
                  onPress={() => {
                    setHandle(actor.handle);
                    void run(async () =>
                      setRecipient(
                        await request<Recipient>("resolveRecipient", {
                          identifier: actor.did,
                        }),
                      ),
                    );
                  }}
                />
              ))}
          {!recipient ? (
            <Button
              title="Find recipient"
              disabled={!handle.trim()}
              onPress={resolve}
            />
          ) : (
            <View className="rounded-xl bg-lilac p-4">
              <Text className="text-base font-semibold">{handle}</Text>
              <Text className="text-xs">{recipient.did}</Text>
            </View>
          )}
          <AmountPad value={amount} onChange={setAmount} />
          <Field
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            placeholder="What's this payment for?"
          />
          <Button
            title="Create payment & review"
            disabled={!recipient || amountWei(amount) === 0n}
            onPress={() =>
              run(async () => {
                const { payment } = await request<{ payment: Payment }>(
                  "createPayment",
                  {
                    identifier: handle,
                    expectedDid: recipient!.did,
                    amount: amount.replace(/\.$/, ""),
                    description: description.trim() || undefined,
                  },
                );
                setId(payment.id);
                await query.invalidateQueries();
              })
            }
          />
        </>
      ) : (
        <>
          {!payment ? (
            <Empty
              text={isFetching ? "Loading payment…" : "Could not load payment."}
            />
          ) : (
            <>
              <View className="gap-4 rounded-3xl bg-white p-5">
                <View className="flex-row items-center gap-3">
                  <Avatar actor={payment.recipient} />
                  <View className="flex-1">
                    <Text className="text-lg font-semibold">
                      {payment.recipient?.displayName || payment.recipientLabel}
                    </Text>
                    <Text className="text-sm text-muted">{payment.state}</Text>
                  </View>
                </View>
                <Text className="text-3xl font-semibold">
                  {payment.amount} ETH
                </Text>
                <Text className="text-sm">
                  {session.network.name} · plus network fee
                </Text>
                <Text selectable className="text-sm text-muted">
                  {payment.address || "Waiting for a receiving address"}
                </Text>
                <Text selectable className="text-xs text-muted">
                  {payment.recipientDid}
                </Text>
                {payment.description && <Text>{payment.description}</Text>}
                {payment.txHash && (
                  <Text selectable className="text-xs">
                    {payment.txHash}
                  </Text>
                )}
                {payment.error && (
                  <Text className="text-sm text-red-700">{payment.error}</Text>
                )}
              </View>
              {payment.senderDid === session.did &&
                ["ready", "prepared"].includes(payment.state) && (
                  <>
                    <View className="flex-row items-center gap-3">
                      <Switch
                        accessibilityLabel="Confirm payment details"
                        value={ack}
                        onValueChange={setAck}
                      />
                      <Text className="flex-1 text-base">
                        I checked the recipient, address, network and amount.
                      </Text>
                    </View>
                    <Button
                      title="Approve in MetaMask"
                      disabled={!ack || hasPending || !session.paymentsEnabled}
                      onPress={() =>
                        run(async () => {
                          try {
                            await sendPayment(
                              session.did!,
                              session.network,
                              payment,
                            );
                          } finally {
                            await reload();
                          }
                        })
                      }
                    />
                  </>
                )}
              {payment.senderDid === session.did &&
                ["waiting", "ready"].includes(payment.state) && (
                  <>
                    <Button
                      title="Share payment invitation"
                      tone="plain"
                      onPress={() =>
                        run(async () => {
                          const data = await request<{ url: string }>(
                            "createInvitation",
                            { id: payment.id },
                          );
                          await Share.share({ message: data.url });
                        })
                      }
                    />
                    <Button
                      title="Cancel payment"
                      tone="plain"
                      onPress={() =>
                        Alert.alert(
                          "Cancel payment?",
                          "No funds will be sent.",
                          [
                            { text: "Keep", style: "cancel" },
                            {
                              text: "Cancel payment",
                              onPress: () =>
                                run(async () => {
                                  await request("cancelPayment", {
                                    id: payment.id,
                                  });
                                  await reload();
                                }),
                            },
                          ],
                        )
                      }
                    />
                  </>
                )}
              <Button
                title="Refresh status"
                tone="plain"
                onPress={() => run(reload)}
              />
            </>
          )}
          <Button
            title="New payment"
            tone="plain"
            onPress={() => {
              setId(null);
              setAmount("0");
              setRecipient(null);
              setHandle("");
              setDescription("");
            }}
          />
        </>
      )}
    </View>
  );
}
