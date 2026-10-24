import { usdToEth, formatUsd, type UsdEthQuote } from '@peachlet/amounts';
import { useEthPrice } from '../eth-price';
import { useTheme } from '../theme';
import { nativeAsset, type Asset } from "../assets";
import { AssetPicker } from "../components/AssetPicker";
import { ContentSkeleton } from "../components/ContentSkeleton";
import { PaymentStatus } from "../components/PaymentStatus";
import * as Clipboard from "expo-clipboard";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Keyboard, Pressable, Share, View } from "react-native";
import { Text } from "../components/Typography";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../api";
import { useAction, useSession } from "../hooks";
import { busyAtom, noticeAtom, reviewAtom, screenAtom } from "../state";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { pending, recover, sendPayment } from "../wallet";
import type { Actor, Payment, PaymentMedia, Recipient } from "../types";
import { Avatar, Button, Empty, Field, Heading } from "../components/ui";
import { Image } from "expo-image";
import { recordShare } from "../klipy";
import { RecipientStep } from "./payment/RecipientStep";
import { DescriptionStep } from "./payment/DescriptionStep";
import { AmountStep } from "./payment/AmountStep";
export function Payments({ onStepChange, keyboardVisible = false }: { onStepChange?: (step: number) => void; keyboardVisible?: boolean }) {
  const { colors } = useTheme();
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
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const asset = selectedAsset && selectedAsset.chainId === session?.network.chainId ? selectedAsset : nativeAsset(session?.network.chainId ?? 1);
  const [entryUnit, setEntryUnit] = useState<'asset' | 'usd'>('asset');
  const canUseUsd = asset.kind === 'native' && asset.symbol === 'ETH' && asset.decimals === 18;
  const inUsd = canUseUsd && entryUnit === 'usd';
  const price = useEthPrice(!!session?.did && inUsd && !id);
  const [usdDraft, setUsdDraft] = useState<(UsdEthQuote & { assetId: string; paymentId?: string }) | null>(null);
  useEffect(() => { setEntryUnit('asset'); setAmount('0'); setUsdDraft(null); }, [asset.id]);
  let usdPreview: UsdEthQuote | null = null;
  if (inUsd && !price.isError) { try { usdPreview = usdToEth(amount.replace(/\.$/, ''), price.data); } catch {} }
  const [media, setMedia] = useState<PaymentMedia | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const busy = useAtomValue(busyAtom);
  const go = useSetAtom(screenAtom);
  const notice = useSetAtom(noticeAtom);
  const [invitation, setInvitation] = useState<{ id: string; url: string } | null>(null);
  async function invitationUrl(paymentId: string) {
    if (invitation?.id === paymentId) return invitation.url;
    const data = await request<{ invitationUrl: string }>("createInvitation", { id: paymentId });
    setInvitation({ id: paymentId, url: data.invitationUrl });
    return data.invitationUrl;
  }
  const resolvingRequest = useRef<AbortController | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  useEffect(() => () => { resolvingRequest.current?.abort(); resolvingRequest.current = null; }, []);
  const cancelResolve = () => {
    resolvingRequest.current?.abort(); resolvingRequest.current = null; setResolving(false);
  };
  const [actor, setActor] = useState<Actor | null>(null);
  useEffect(() => { onStepChange?.(id ? 4 : step); }, [step, id]);
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
  const finished = !!payment && ["submitted", "confirming", "confirmed", "failed", "cancelled", "expired"].includes(payment.state);
  const resetDraft = () => {
    setId(null); setStep(1); setActor(null); setAmount("0"); setEntryUnit("asset"); setUsdDraft(null);
    setRecipient(null); setHandle(""); setDescription(""); setMedia(null);
    setAck(false); setHash(""); setInvitation(null);
  };
  const currentStep = id ? 4 : step;
  const canEdit = !!recipient && payment?.senderDid === session?.did &&
    ["waiting", "ready"].includes(payment?.state || "") && !hasPending;
  const navigateBack = (target: 1 | 2 | 3) => {
    if (busy || target >= currentStep || (id && !canEdit)) return;
    Keyboard.dismiss();
    if (!id) { setStep(target); return; }
    void run(async () => {
      // Invalidate the old intent before editing; never reuse its approved details.
      await request("cancelPayment", { id });
      setAck(false); setId(null); setStep(target);
      await query.invalidateQueries();
    });
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentStep <= 1) return false;
      if (!busy) {
        if (id && !canEdit) go('Activity');
        else navigateBack((currentStep - 1) as 1 | 2 | 3);
      }
      return true;
    });
    return () => subscription.remove();
  }, [currentStep, id, canEdit, busy]);
  if (!session?.did)
    return <Empty text="Sign in from Account to send a payment." />;
  const reload = async () => {
    await query.invalidateQueries();
    setPending(!!(await pending(session.did!)));
  };
  const resolve = (selected?: Actor) => {
    if (resolvingRequest.current || busy) return;
    const controller = new AbortController();
    resolvingRequest.current = controller;
    setResolving(true); setResolveError('');
    if (selected) { setActor(selected); setHandle(selected.handle); }
    Keyboard.dismiss();
    return run(async () => {
      try {
        const result = await request<Recipient>("resolveRecipient", {
          identifier: selected?.did || actor?.did || handle,
        }, undefined, { signal: controller.signal, timeoutMs: 15_000 });
        if (controller.signal.aborted || resolvingRequest.current !== controller) return;
        if (result.did === session.did) throw new Error("You cannot send ETH to yourself.");
        setRecipient(result); setStep(2);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResolveError(error instanceof Error ? error.message : 'Could not verify recipient. Try again.');
        throw error;
      } finally {
        if (resolvingRequest.current === controller) {
          resolvingRequest.current = null; setResolving(false);
        }
      }
    });
  };
  const recoverPayment = () => run(async () => { await recover(session.did!, hash || undefined); await reload(); });
  const compact = keyboardVisible && currentStep === 1;
  return (
    <View className={currentStep === 2 ? "flex-1 gap-3" : currentStep > 1 ? "gap-3" : "gap-5"}>
      {!compact && <>
      <View className="flex-row items-center justify-between">
        {currentStep > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${id && !canEdit ? 'activity' : currentStep === 2 ? 'recipient' : currentStep === 3 ? 'amount' : 'description'}`}
          disabled={busy} onPress={() => id && !canEdit ? go('Activity') : navigateBack((currentStep - 1) as 1 | 2 | 3)} className="min-h-12 flex-row items-center gap-2 pr-4">
          <ArrowLeft size={24} color={colors.ink} accessible={false} /><Text className="text-base">Back</Text>
        </Pressable> : <Text className="text-base font-medium">Send</Text>}
        <Text accessibilityLabel={`Step ${currentStep} of 4`} className="text-sm text-muted">Step {currentStep} of 4</Text>
      </View>
      <View className="flex-row gap-2">
        {['Recipient', 'Amount', 'Description', 'Review'].map((label, index) => {
          const value = index + 1;
          const enabled = value < currentStep && (!id || canEdit) && !busy;
          return <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Go to ${label.toLowerCase()} step`}
            accessibilityState={{ disabled: !enabled, selected: value === currentStep }} disabled={!enabled}
            onPress={() => navigateBack(value as 1 | 2 | 3)} className="min-h-12 flex-1 justify-center gap-2">
            <View className={`h-1 rounded-full ${value <= currentStep ? 'bg-ink' : 'bg-edge'}`} />
            <Text numberOfLines={1} adjustsFontSizeToFit className={`text-xs ${value === currentStep ? 'font-bold text-ink' : 'text-muted'}`}>{label}</Text>
          </Pressable>;
        })}
      </View>
      <Heading title={id ? finished ? "Payment details" : "Review payment" : step === 1 ? "Who are you paying?" : step === 2 ? "How much?" : "Add a note"}
        subtitle={id ? finished ? "You can follow this payment in Activity." : "Check every detail before approving payment." : step === 1 ? "Find someone by their Atmosphere account." : step === 2 ? "Enter the amount you want to send." : "Make it personal with a message or GIF. You can leave this blank."} />
      </>}
      {hasPending && !compact && (
        <View className="gap-3 rounded-2xl bg-peach p-4">
          <Text className="text-base">
            A previous wallet request needs recovery. Check your wallet before
            sending again.
          </Text>
          <Field
            label="Original transaction hash (if needed)"
            value={hash}
            onChangeText={setHash}
            onSubmitEditing={recoverPayment}
            autoCapitalize="none"
          />
          <Button
            title="Recover transaction"
            onPress={recoverPayment}
          />
        </View>
      )}
      {!id && step === 1 && resolving && <View className="gap-3">
        <ContentSkeleton variant="line" label="Verifying recipient" />
        <Text className="text-sm text-muted">Verifying recipient…</Text>
        <Pressable accessibilityRole="button" onPress={cancelResolve} className="min-h-12 items-center justify-center"><Text className="font-bold">Cancel lookup</Text></Pressable>
      </View>}
      {!id && step === 1 && !!resolveError && !resolving && <View className="gap-2">
        <Text accessibilityRole="alert" className="text-sm text-red-700">{resolveError}</Text>
        <Button title="Retry recipient lookup" tone="plain" onPress={() => void resolve()} />
      </View>}
      {!id ? (
        step === 1 ? <RecipientStep handle={handle} ownDid={session.did} compact={compact}
          onChange={value => { cancelResolve(); setResolveError(''); setHandle(value); setActor(null); setRecipient(null); }}
          onSelect={selected => { if (!busy) void resolve(selected); }} onSubmit={() => { if (!busy && handle.trim()) void resolve(); }} /> :
        step === 2 ? <AmountStep actor={actor} handle={recipient?.handle || handle} amount={amount}
          decimals={asset.decimals} symbol={asset.symbol} assetPicker={<AssetPicker session={session} value={asset} onChange={value => { setSelectedAsset(value); setAmount("0"); }} />}
          usdMode={inUsd} onUnitChange={canUseUsd ? usd => { setEntryUnit(usd ? 'usd' : 'asset'); setAmount('0'); setUsdDraft(null); } : undefined}
          conversion={usdPreview ? `≈ ${usdPreview.eth} ETH · network fee extra${session.network.chainId === 6343 ? ' · testnet estimate' : ''}` : undefined}
          conversionError={price.isError || (price.data && Date.now() - price.data.updatedAt >= 300_000) ? 'ETH price unavailable or expired. Refresh the rate or enter ETH.' : undefined}
          conversionPending={price.isFetching} onRefreshRate={() => void price.refetch()}
          onAmount={value => { setAmount(value); setUsdDraft(null); }} onContinue={() => {
            if (inUsd) {
              try { if (price.isError) throw new Error('Refresh the ETH price to continue.'); setUsdDraft({ ...usdToEth(amount.replace(/\.$/, ''), price.data), assetId: asset.id }); }
              catch (error) { notice(error instanceof Error ? error.message : 'Refresh the ETH price to continue.'); return; }
            } else setUsdDraft(null);
            setStep(3);
          }} /> :
        <DescriptionStep description={description} onDescription={setDescription} media={media} onMedia={setMedia}
          onReview={() => run(async () => {
            if (!recipient || recipient.did === session.did) throw new Error("Choose a different recipient.");
            let sendAmount = amount.replace(/\.$/, '');
            if (inUsd) {
              try {
                if (!usdDraft || usdDraft.assetId !== asset.id) throw new Error('Review the USD conversion again.');
                const checked = usdToEth(sendAmount, { usd: usdDraft.rate, updatedAt: usdDraft.updatedAt });
                if (checked.amountWei !== usdDraft.amountWei) throw new Error('The amount changed. Review the conversion again.');
                sendAmount = usdDraft.eth;
              } catch (error) { setStep(2); setUsdDraft(null); throw error; }
            }
            const { payment } = await request<{ payment: Payment }>("createPayment", {
              assetId: asset.id, identifier: recipient.did, expectedDid: recipient.did,
              amount: sendAmount, description: description.trim() || undefined, media: media || undefined,
            });
            Keyboard.dismiss();
            query.setQueryData(["payment", session.did, payment.id], { payment });
            if (inUsd && usdDraft) setUsdDraft({ ...usdDraft, paymentId: payment.id });
            setId(payment.id);
            if (media) void recordShare(media, "");
            await query.invalidateQueries();
          })} />
      ) : (
        <>
          {!payment ? (
            isFetching ? <ContentSkeleton variant="card" label="Loading payment" /> : <Empty text="Could not load payment." />
          ) : (
            <>
              <View className="gap-4 rounded-3xl bg-surface p-5">
                <View className="flex-row items-center gap-3">
                  <Avatar actor={payment.recipient} />
                  <View className="flex-1">
                    <Text className="text-lg font-semibold">
                      {payment.recipient?.displayName || payment.recipientLabel}
                    </Text>
                    <PaymentStatus state={payment.state} />
                  </View>
                </View>
                <Text className="text-3xl font-semibold">
                  {payment.amount} {payment.asset}
                </Text>
                {usdDraft?.paymentId === payment.id && usdDraft.amountWei === payment.amountWei && usdDraft.assetId === payment.assetId && <Text className="text-sm text-muted">{formatUsd(usdDraft.usd)} USD at ${usdDraft.rate}/ETH. ETH amount fixed; USD value may change. Network fee extra.</Text>}
                <Text className="text-sm">
                  {session.network.name} · plus network fee
                </Text>
                <Text selectable className="text-sm text-muted">
                  {payment.address || "Waiting for a receiving address"}
                </Text>
                <Text selectable className="text-xs text-muted">
                  {payment.recipientDid}
                </Text>
                {payment.assetDetails?.contractAddress && <Text selectable className="font-mono text-xs text-muted">Token contract: {payment.assetDetails.contractAddress}</Text>}
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
                      title="Review & send"
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
                          await Share.share({ message: await invitationUrl(payment.id) });
                        })
                      }
                    />
                    <Button title="Copy invitation link" tone="plain" onPress={() => run(async () => {
                      await Clipboard.setStringAsync(await invitationUrl(payment.id));
                      notice("Invitation link copied.");
                    })} />
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
              {canEdit && <Button title="Edit details" tone="plain" onPress={() => navigateBack(3)} />}
              <Button
                title="Refresh status"
                tone="plain"
                onPress={() => run(reload)}
              />
            </>
          )}
          <View className="flex-row items-center gap-3">
          <View className="flex-1"><Button title="Done" onPress={() => { Keyboard.dismiss(); resetDraft(); go("Activity"); }} /></View>
          <View className="flex-1"><Button
            title="New payment"
            tone="plain"
            onPress={resetDraft}
          /></View>
          </View>
        </>
      )}
    </View>
  );
}
