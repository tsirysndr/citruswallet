import { ContentSkeleton } from "../ContentSkeleton";
import { useState } from "react";
import { View, Pressable } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAtom, useSetAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inviteTokenAtom, noticeAtom, screenAtom } from "../../state";
import { request } from "../../api";
import { useAction, useSession } from "../../hooks";
import type { Payment } from "../../types";
import { Text } from "../Typography";
import { Button, Heading } from "../ui";
export function InvitationPanel() {
  const [token, setToken] = useAtom(inviteTokenAtom);
  const { data: session } = useSession();
  const go = useSetAtom(screenAtom), notice = useSetAtom(noticeAtom), run = useAction(), query = useQueryClient();
  const [selected, setSelected] = useState("");
  const { data, error, isPending } = useQuery({
    queryKey: ["invitation", token, session?.did], enabled: !!token && !!session?.did,
    queryFn: () => request<{ payment: Payment }>("getInvitation", undefined, { token: token! }),
  });
  if (!token) return null;
  const payment = data?.payment;
  const links = session?.links.filter(link => link.chain_id === session.network.chainId) ?? [];
  const address = links.some(link => link.address === selected) ? selected : "";
  return <View className="mb-5 gap-3 rounded-2xl bg-white p-5">
    <Heading title="Payment invitation" />
    {!session?.did ? <>
      <Text className="text-sm text-muted">Sign in with the Atmosphere account this invitation was sent to.</Text>
      <Button title="Sign in to view invitation" onPress={() => go("Account")} />
    </> : error ? <Text accessibilityRole="alert" className="text-sm text-red-700">{error.message}</Text> : isPending ?
      <ContentSkeleton variant="card" label="Loading invitation" /> : payment ? <>
      <Text className="text-lg font-semibold">{payment.amount} {payment.asset} from {payment.sender?.displayName || payment.sender?.handle || payment.senderDid}</Text>
      <Text className="text-sm text-muted">No funds have been deposited. Choose a wallet to share with the sender, who must still approve the transfer.</Text>
      {["waiting", "ready"].includes(payment.state) ? <>
        {links.map(link => <Pressable key={link.address} accessibilityRole="radio" accessibilityLabel={link.address}
          accessibilityState={{ checked: address === link.address }} onPress={() => setSelected(link.address)}
          className={`rounded-lg p-3 ${address === link.address ? "bg-accent" : "bg-canvas"}`}>
          <Text className="font-mono text-sm">{link.address}</Text>
          <Text className="text-sm text-muted">{link.public ? "Public" : "Private"} · {session.network.name}</Text>
        </Pressable>)}
        {!links.length && <Button title="Link a receiving wallet" onPress={() => go("Wallet")} />}
        <Button title="Use this address for this payment" disabled={!address} onPress={() => run(async () => {
          await request("acceptInvitation", { token, address });
          await SecureStore.deleteItemAsync("citrus-invitation");
          setToken(null);
          notice("Receiving address shared. The sender must approve the transfer.");
          await query.invalidateQueries();
        })} />
      </> : <Text>This invitation is {payment.state} and can no longer be accepted.</Text>}
    </> : null}
    <Button title="Dismiss invitation" tone="plain" onPress={() => run(async () => {
      await SecureStore.deleteItemAsync("citrus-invitation"); setToken(null);
    })} />
  </View>;
}
