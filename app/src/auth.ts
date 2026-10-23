import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { origin, request, saveToken } from "./api";
const random = () =>
  Array.from(Crypto.getRandomBytes(32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
let exchanging: Promise<boolean> | undefined;
export async function finishLogin(url: string): Promise<boolean> {
  if (exchanging) return exchanging;
  exchanging = (async () => {
    const parsed = new URL(url);
    if (parsed.protocol !== "citruswallet:" || parsed.hostname !== "auth")
      return false;
    const raw = await SecureStore.getItemAsync("citrus-login");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (
      Date.now() - saved.created > 600000 ||
      parsed.searchParams.get("state") !== saved.state
    )
      throw new Error("Login expired or belongs to another request.");
    const code = parsed.searchParams.get("code");
    if (!code) throw new Error("Login did not return an authorization code.");
    const { token } = await request<{ token: string }>(
      "exchangeNativeSession",
      { code, verifier: saved.verifier },
    );
    await saveToken(token);
    await SecureStore.deleteItemAsync("citrus-login");
    return true;
  })().finally(() => {
    exchanging = undefined;
  });
  return exchanging;
}
export async function signIn(identifier: string) {
  const verifier = random(),
    state = random();
  const challenge = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
  );
  await SecureStore.setItemAsync(
    "citrus-login",
    JSON.stringify({ verifier, state, created: Date.now() }),
  );
  const url = `${origin}/auth/native/start?${new URLSearchParams({ identifier: identifier.trim().replace(/^@/, ""), challenge, state })}`;
  const result = await WebBrowser.openAuthSessionAsync(
    url,
    "citruswallet://auth",
  );
  if (result.type === "success") return finishLogin(result.url);
  return false;
}
