import { ThemeSwitch } from "../components/ThemeSwitch";
import { useEffect, useState } from "react";
import { Alert, BackHandler, Keyboard, Pressable, Share, View } from "react-native";
import { Text } from "../components/Typography";
import { useAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../api";
import { useAction, useSession } from "../hooks";
import { reviewAtom } from "../state";
import { Ionicons } from "@expo/vector-icons";
import { pending, recover, sendPayment } from "../wallet";
import type { Actor, Payment, PaymentMedia, Recipient } from "../types";
import { Avatar, Button, Empty, Field, Heading } from "../components/ui";
import { Image } from "expo-image";
import { recordShare } from "../klipy";
import { RecipientStep } from "./payment/RecipientStep";
import { AmountStep } from "./payment/AmountStep";
export function Payments({ onStepChange }: { onStepChange?: () => void }) {
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
  const [media, setMedia] = useState<PaymentMedia | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [actor, setActor] = useState<Actor | null>(null);
  useEffect(() => { onStepChange?.(); }, [step, id]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!id && step === 2) { setStep(1); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [step, id]);
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
        identifier: actor?.did || handle,
      });
      if (result.did === session.did)
        throw new Error("You cannot send ETH to yourself.");
      setRecipient(result);
      Keyboard.dismiss();
      setStep(2);
    });
  return (
    <View className="gap-5">
      <View className="flex-row items-center justify-between">
        {!id && step === 2 ? <Pressable accessibilityRole="button" accessibilityLabel="Back to recipient"
          onPress={() => setStep(1)} className="min-h-12 flex-row items-center gap-2 pr-4">
          <Ionicons name="arrow-back" size={24} color="#191916" /><Text className="text-base">Back</Text>
        </Pressable> : <Text className="text-base font-medium">Send ETH</Text>}
        <Text accessibilityLabel={`Step ${id ? 3 : step} of 3`} className="text-sm text-muted">Step {id ? 3 : step} of 3</Text>
      </View>
      <View className="flex-row gap-2">
        {[1, 2, 3].map(value => <View key={value} className={`h-1 flex-1 rounded-full ${value <= (id ? 3 : step) ? 'bg-ink' : 'bg-edge'}`} />)}
      </View>
      <Heading title={id ? "Review payment" : step === 1 ? "Who are you paying?" : "How much?"}
        subtitle={id ? "Check every detail before opening MetaMask." : step === 1 ? "Find someone by their AT Protocol handle." : "Enter an amount and add an optional note."} />
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
        step === 1 ? <RecipientStep handle={handle} actor={actor} ownDid={session.did}
          onChange={value => { setHandle(value); setActor(null); setRecipient(null); }}
          onSelect={setActor} onContinue={resolve} /> :
        <AmountStep actor={actor} handle={handle} amount={amount} description={description}
          onAmount={setAmount} onDescription={setDescription} media={media} onMedia={setMedia}
          onReview={() => run(async () => {
            if (!recipient || recipient.did === session.did) throw new Error("Choose a different recipient.");
            const { payment } = await request<{ payment: Payment }>("createPayment", {
              identifier: recipient.did, expectedDid: recipient.did,
              amount: amount.replace(/\.$/, ""), description: description.trim() || undefined, media: media || undefined,
            });
            Keyboard.dismiss();
            query.setQueryData(["payment", session.did, payment.id], { payment });
            setId(payment.id);
            if (media) void recordShare(media, "");
            await query.invalidateQueries();
          })} />
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
                {payment.media && <Image source={{ uri: payment.media.preview }} style={{ width: "100%", height: 160 }} contentFit="contain" accessibilityLabel={payment.media.title} />}
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
                      <ThemeSwitch
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
              {recipient && payment.senderDid === session.did && ["waiting", "ready"].includes(payment.state) && (
                <Button title="Edit details" tone="plain" onPress={() => run(async () => {
                  await request("cancelPayment", { id: payment.id });
                  setId(null); setStep(2); await query.invalidateQueries();
                })} />
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
              setStep(1);
              setActor(null);
              setAmount("0");
              setRecipient(null);
              setHandle("");
              setDescription("");
              setMedia(null);
            }}
          />
        </>
      )}
    </View>
  );
}
