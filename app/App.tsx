import { Settings } from './src/screens/Settings';
import SettingsIcon from 'lucide-react-native/icons/settings';
import { WalletEntry } from './src/components/WalletEntry';
import { configuredAddress, loadWalletPreference } from './src/wallet-preferences';
import { WalletUnlock } from "./src/components/WalletUnlock";
import { loadNetwork, saveNetwork } from "./src/network";
import { loadNativeVault, nativeVaultState, subscribeNativeVault } from "./src/local-wallet";
import { ContentSkeleton } from "./src/components/ContentSkeleton";
import "./global.css";
import * as SecureStore from "expo-secure-store";
import type { Session } from "./src/types";
import { invitationToken, invitationChain } from "./src/invitation-link";
import { InvitationPanel } from "./src/components/InvitationPanel";
import { useNoticeTimeout } from "./src/useNoticeTimeout";
import { useNotifications } from "./src/notifications";
import { NotificationsInbox } from "./src/components/NotificationsInbox";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
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
  inviteTokenAtom,
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
  const [invite, setInvite] = useAtom(inviteTokenAtom);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [screen, setScreen] = useAtom(screenAtom),
    [notice, setNotice] = useAtom(noticeAtom),
    busy = useAtomValue(busyAtom),
    ready = useAtomValue(readyAtom),
    setReady = useSetAtom(readyAtom);
  const query = useQueryClient(),
    session = useSession();
  useNotifications(session.data?.did);
  useNoticeTimeout();
  useEffect(() => { if (invite && session.data?.did) setScreen("Wallet"); }, [invite, session.data?.did]);
  useEffect(() => {
    void Promise.all([loadToken(), loadNativeVault(), loadNetwork(), loadWalletPreference()])
      .then(() => setReady(true))
      .catch(() =>
        setNotice("Could not access secure storage. Restart the app."),
      );
    const handle = async (url: string) => {
      try {
        const token = invitationToken(url);
        if (token) {
          const chain = invitationChain(url);
          if (chain) { await saveNetwork(chain, ""); await query.cancelQueries(); query.clear(); }
          await SecureStore.setItemAsync("citrus-invitation", token);
          setInvite(token);
          setScreen(query.getQueryData<Session>(["session"])?.did ? "Wallet" : "Account");
          return;
        }
        if (await finishLogin(url)) {
          await query.resetQueries();
          setScreen("Account");
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Sign in failed.");
      }
    };
    void Linking.getInitialURL().then(async url => {
      if (url && invitationToken(url)) await handle(url);
      else {
        const saved = await SecureStore.getItemAsync("citrus-invitation");
        if (saved && /^[a-f0-9]{64}$/.test(saved)) setInvite(saved);
        if (url) await handle(url);
      }
    }).catch(() => setNotice("Could not restore the invitation. Open its link again."));
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
  const vault = useSyncExternalStore(subscribeNativeVault, nativeVaultState);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const checkedAccount = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const data = session.data;
    if (!ready || session.isPending || (needsSetup !== null && checkedAccount.current === data?.did)) return;
    checkedAccount.current = data?.did;
    if (!data?.did) { setNeedsSetup(true); return; }
    const address = configuredAddress();
    const configured = vault !== 'absent' || !!address || data.links.length > 0;
    const linked = data.links.some(link => link.chain_id === data.network.chainId && link.public && link.is_default && (!address || link.address.toLowerCase() === address.toLowerCase()));
    setNeedsSetup(!configured || !data.did || !linked);
  }, [ready, session.data, session.isPending, needsSetup, vault]);
  const compactRecipient = screen === "Payments" && paymentStep === 1 && keyboardVisible;
  const feedback = <>
          {refreshing && <ContentSkeleton label="Refreshing content" rows={1} />}
          {(screen === "Account" || screen === "Wallet") && <InvitationPanel />}
          {notice ? (
            <Pressable
              accessibilityLabel="Dismiss notice"
              onPress={() => setNotice("")}
              className="mb-4 rounded-xl bg-peach p-4"
            >
              <Text className="text-sm">{notice}</Text>
            </Pressable>
          ) : null}
          {busy && <ContentSkeleton variant="line" label="Working" />}
          {busy && (
            <Text
              accessibilityLiveRegion="polite"
              className="mb-4 text-sm text-muted"
            >
              Follow the wallet prompt to continue.
            </Text>
          )}
          {session.error && (
            <Pressable onPress={() => void session.refetch()}>
              <Text className="mb-4 text-red-700">
                Could not reach the server. Tap to retry.
              </Text>
            </Pressable>
          )}
  </>;
  if (needsSetup === null || needsSetup) return <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
    {session.data?.did && <WalletUnlock />}<StatusBar style="dark" />
    <View className="flex-row items-center gap-3 px-5 py-4"><Image source={require('./assets/icon.png')} style={{ width: 42, height: 42 }} /><Text className="text-xl font-bold">Citrus Wallet</Text></View>
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
      {ready && !session.isPending && !session.error ? <WalletEntry onFinished={() => { setNeedsSetup(false); setScreen(invite ? 'Wallet' : 'Account'); }} /> : <ContentSkeleton label="Opening Citrus" />}
      {feedback}
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>;
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <WalletUnlock /><StatusBar style="dark" />
      {!compactRecipient && <View className="flex-row items-center justify-between px-5 py-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Citrus Wallet home" disabled={busy} onPress={() => { Keyboard.dismiss(); setScreen("Account"); }} className="min-w-0 flex-1 flex-row items-center gap-3">
          <Image source={require('./assets/icon.png')} accessibilityLabel="Citrus Wallet logo" style={{ width: 42, height: 42 }} />
          <Text numberOfLines={1} adjustsFontSizeToFit className="flex-shrink text-xl font-bold text-ink">Citrus Wallet</Text>
        </Pressable>
        <View className="items-end pl-2">
          <View className="flex-row items-center gap-2"><NotificationsInbox /><Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} onPress={() => setScreen("Settings")}><SettingsIcon size={23} color="#292d26" /></Pressable></View>
          <Text className="text-xs text-muted">
            <Text style={{ color: "#39e75f" }}>● </Text>
            {session.data?.network.name || "Ethereum"}
          </Text>
        </View>
      </View>
      }
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {ready && screen === "Activity" ? <Activity header={feedback} /> : <ScrollView
          ref={scroll}
          key={screen}
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing} colors={["transparent"]} tintColor="transparent" progressBackgroundColor="transparent"
              onRefresh={() => { setRefreshing(true); void query.invalidateQueries().finally(() => setRefreshing(false)); }}
            />
          }
        >
          {!compactRecipient && feedback}
          {!ready || session.isPending ? (
            <ContentSkeleton variant="card" label="Opening Citrus" />
          ) : screen === "Account" ? (
            <Account />
          ) : screen === "Wallet" ? (
            <Wallet />
          ) : screen === "Settings" ? (<Settings />
          ) : screen === "Payments" ? (
            <Payments keyboardVisible={keyboardVisible} onStepChange={step => { setPaymentStep(step); scroll.current?.scrollTo({ y: 0, animated: false }); }} />
          ) : null}
          {compactRecipient && !!notice && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-700">{notice}</Text>}
        </ScrollView>}
      </KeyboardAvoidingView>
      {screen !== "Settings" && !compactRecipient && (screen !== "Payments" || paymentStep === 1) && <BottomTabs screen={screen} onChange={setScreen} />}
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
