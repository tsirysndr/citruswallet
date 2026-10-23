import "./global.css";
import { useNotifications } from "./src/notifications";
import { NotificationsInbox } from "./src/components/NotificationsInbox";
import { useEffect, useRef } from "react";
import { AppState, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "./src/components/Typography";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { BottomTabs } from "./src/components/BottomTabs";
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
function Shell() {
  const scroll = useRef<ScrollView>(null);
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
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <Image source={require('./assets/icon.png')} accessibilityLabel="Citrus Wallet logo" style={{ width: 42, height: 42 }} />
          <Text numberOfLines={1} adjustsFontSizeToFit className="flex-shrink text-xl font-bold text-ink">Citrus Wallet</Text>
        </View>
        <View className="items-end pl-2">
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
          ref={scroll}
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
            <Payments onStepChange={() => scroll.current?.scrollTo({ y: 0, animated: false })} />
          ) : (
            <Activity />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomTabs screen={screen} onChange={setScreen} />
    </SafeAreaView>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Rockford: require('./assets/fonts/RockfordSans-Regular.otf'),
    RockfordMedium: require('./assets/fonts/RockfordSans-Medium.otf'),
    RockfordBold: require('./assets/fonts/RockfordSans-Bold.otf'),
  });
  if (!fontsLoaded && !fontError) return null;
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
