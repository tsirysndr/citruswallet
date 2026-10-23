import { selectedChain, saveNetwork } from "./network";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EventSource from "react-native-sse";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { currentToken, origin, request } from "./api";
import { noticeAtom, reviewAtom, screenAtom } from "./state";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export type Notice = {
  id: string;
  paymentId: string;
  createdAt: string;
  read: boolean;
};
export async function enablePush() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("payments", {
      name: "Payments received",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted)
    permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted)
    throw new Error(
      "Notifications are disabled. You can enable them in device settings.",
    );
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("This build has no Expo project ID.");
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await request("registerPushToken", { token, platform: Platform.OS });
  await AsyncStorage.setItem("citrus-push-token", token);
}
export async function disablePush() {
  const token = await AsyncStorage.getItem("citrus-push-token");
  if (token) await request("unregisterPushToken", { token });
  await AsyncStorage.removeItem("citrus-push-token");
}
export function useNotifications(did?: string | null) {
  const query = useQueryClient(),
    notice = useSetAtom(noticeAtom),
    review = useSetAtom(reviewAtom),
    screen = useSetAtom(screenAtom);
  useEffect(() => {
    if (!did) return;
    let source:
        | EventSource<"payment-received" | "session-expired" | "ready">
        | undefined,
      disposed = false,
      opening = false;
    const key = "notification-cursor:" + did + ":" + (selectedChain() || "default");
    const connect = async () => {
      if (
        disposed ||
        opening ||
        source ||
        AppState.currentState !== "active" ||
        !currentToken()
      )
        return;
      opening = true;
      try {
        const cursor = (await AsyncStorage.getItem(key)) || "0";
        if (disposed) return;
        source = new EventSource(
          `${origin}/xrpc/app.citruswallet.subscribeNotifications?cursor=${cursor}${selectedChain() ? `&chainId=${selectedChain()}` : ""}`,
          {
            headers: { Authorization: `Bearer ${currentToken()}` },
            pollingInterval: 5000,
          },
        );
        source.addEventListener("payment-received", (event) => {
          if (!event.data) return;
          try {
            const data = JSON.parse(event.data) as Notice;
            void AsyncStorage.setItem(key, data.id);
            void query.invalidateQueries({ queryKey: ["notifications"] });
            void query.invalidateQueries({ queryKey: ["activity"] });
            void query.invalidateQueries({ queryKey: ["balance"] });
            notice("Payment received. Open your notifications to view it.");
          } catch {}
        });
        source.addEventListener("session-expired", () => {
          source?.close();
          source = undefined;
          void query.invalidateQueries({ queryKey: ["session"] });
        });
      } finally {
        opening = false;
      }
    };
    void connect();
    const state = AppState.addEventListener("change", (value) => {
      if (value === "active") void connect();
      else {
        source?.close();
        source = undefined;
      }
    });
    const open = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (typeof data.paymentId === "string") {
        const chain = String(data.chainId || 1);
        if (["1", "4326"].includes(chain) && selectedChain() !== chain) {
          await saveNetwork(chain, "");
          await query.cancelQueries(); query.clear();
        }
        review(data.paymentId);
        screen("Payments");
        if (typeof data.notificationId === "string")
          void request("markNotificationRead", { id: data.notificationId })
            .then(() =>
              query.invalidateQueries({ queryKey: ["notifications"] }),
            )
            .catch(() => {});
      }
    };
    const received =
      Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && !disposed) {
        open(response);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      disposed = true;
      source?.close();
      state.remove();
      received.remove();
    };
  }, [did, query, notice, review, screen]);
}
