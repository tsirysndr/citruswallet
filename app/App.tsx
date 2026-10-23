import "./global.css";
import { useNotifications } from "./src/notifications";
import { NotificationsInbox } from "./src/components/NotificationsInbox";
import { useEffect } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  useQueryClient,
} from "@tanstack/react-query";
import { loadToken } from "./src/api";
import { finishLogin } from "./src/auth";
import { useSession } from "./src/hooks";
import {
  busyAtom,
  noticeAtom,
  readyAtom,
  screenAtom,
  type Screen,
} from "./src/state";
import { Account } from "./src/screens/Account";
import { Wallet } from "./src/screens/Wallet";
import { Payments } from "./src/screens/Payments";
import { Activity } from "./src/screens/Activity";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000 },
    mutations: { retry: false },
  },
});
const tabs: {
  name: Screen;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { name: "Account", icon: "person-outline" },
  { name: "Wallet", icon: "wallet-outline" },
  { name: "Payments", icon: "arrow-up-outline" },
  { name: "Activity", icon: "time-outline" },
];
function Shell() {
  const [screen, setScreen] = useAtom(screenAtom),
    [notice, setNotice] = useAtom(noticeAtom),
    busy = useAtomValue(busyAtom),
    ready = useAtomValue(readyAtom),
    setReady = useSetAtom(readyAtom);
  const query = useQueryClient(),
    session = useSession();
  useNotifications(session.data?.did);
  useEffect(() => {
    void loadToken()
      .then(() => setReady(true))
      .catch(() =>
        setNotice("Could not access secure storage. Restart the app."),
      );
    const handle = async (url: string) => {
      try {
        if (await finishLogin(url)) {
          await query.resetQueries();
          setScreen("Account");
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Sign in failed.");
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) void handle(url);
    });
    const links = Linking.addEventListener(
      "url",
      (event) => void handle(event.url),
    );
    const state = AppState.addEventListener("change", (value) =>
      focusManager.setFocused(value === "active"),
    );
    return () => {
      links.remove();
      state.remove();
    };
  }, []);
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-5 py-4">
        <Text className="text-xl font-bold text-ink">◉ Citrus Wallet</Text>
        <View className="flex-row items-center gap-1">
          <NotificationsInbox />
          <Text className="text-xs text-muted">
            <Text style={{ color: "#39e75f" }}>● </Text>
            {session.data?.network.name || "Ethereum"}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          key={screen}
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void query.invalidateQueries()}
            />
          }
        >
          {notice ? (
            <Pressable
              accessibilityLabel="Dismiss notice"
              onPress={() => setNotice("")}
              className="mb-4 rounded-xl bg-peach p-4"
            >
              <Text className="text-sm">{notice}</Text>
            </Pressable>
          ) : null}
          {busy && (
            <Text
              accessibilityLiveRegion="polite"
              className="mb-4 text-sm text-muted"
            >
              Working… If MetaMask opens, approve there and return here.
            </Text>
          )}
          {session.error && (
            <Pressable onPress={() => void session.refetch()}>
              <Text className="mb-4 text-red-700">
                Could not reach the server. Tap to retry.
              </Text>
            </Pressable>
          )}
          {!ready ? (
            <Text>Opening Citrus…</Text>
          ) : screen === "Account" ? (
            <Account />
          ) : screen === "Wallet" ? (
            <Wallet />
          ) : screen === "Payments" ? (
            <Payments />
          ) : (
            <Activity />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <View className="flex-row border-t border-edge bg-white px-2 py-2">
        {tabs.map((tab) => (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: screen === tab.name }}
            onPress={() => setScreen(tab.name)}
            className={`flex-1 items-center gap-1 rounded-2xl py-3 ${screen === tab.name ? "bg-accent" : ""}`}
          >
            <Ionicons name={tab.icon} size={23} color="#191916" />
            <Text className="text-xs text-ink">{tab.name}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Provider>
        <QueryClientProvider client={client}>
          <Shell />
        </QueryClientProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
