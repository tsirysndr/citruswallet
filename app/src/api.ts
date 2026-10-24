import { selectedChain } from "./network";
import { lockNativeWallet } from "./local-wallet";
import * as SecureStore from "expo-secure-store";
export const origin = (
  process.env.EXPO_PUBLIC_API_URL || "https://peachlet.app"
).replace(/\/$/, "");
if (!origin.startsWith("https://") && !__DEV__)
  throw new Error("Production API must use HTTPS.");
let token: string | null = null;
let returningUser = false;
export function hasSignedIn() { return returningUser; }
export function currentToken() {
  return token;
}
export async function loadToken() {
  token = await SecureStore.getItemAsync("citrus-session");
  returningUser = Boolean(token) || await SecureStore.getItemAsync('citrus-has-signed-in') === 'true';
  // Older installations may already be signed out and have no history marker.
  // A saved wallet choice is enough to offer sign-in; it is not proof of a vault.
  const previousWallet = await SecureStore.getItemAsync('citrus-wallet-mode');
  returningUser ||= previousWallet === 'citrus' || previousWallet === 'metamask';
  if (token) await SecureStore.setItemAsync('citrus-has-signed-in', 'true');
  return token;
}
export async function saveToken(value: string | null) {
  // Retain returning-user navigation independently of wallet type or session.
  await SecureStore.setItemAsync('citrus-has-signed-in', 'true');
  returningUser = true;
  if (value) await SecureStore.setItemAsync("citrus-session", value);
  else { lockNativeWallet(); await SecureStore.deleteItemAsync("citrus-session"); }
  token = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  method: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${origin}/xrpc/app.peachlet.${method}`);
  for (const [key, value] of Object.entries(params ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const response = await fetch(url.toString(), {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    headers: {
      ...(selectedChain() ? { "x-peachlet-chain-id": selectedChain()! } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.message || "Request failed. Please try again.",
      response.status,
    );
  return data;
}
