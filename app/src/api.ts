import * as SecureStore from "expo-secure-store";
export const origin = (
  process.env.EXPO_PUBLIC_API_URL || "https://citruswallet.app"
).replace(/\/$/, "");
if (!origin.startsWith("https://") && !__DEV__)
  throw new Error("Production API must use HTTPS.");
let token: string | null = null;
export function currentToken() {
  return token;
}
export async function loadToken() {
  token = await SecureStore.getItemAsync("citrus-session");
  return token;
}
export async function saveToken(value: string | null) {
  if (value) await SecureStore.setItemAsync("citrus-session", value);
  else await SecureStore.deleteItemAsync("citrus-session");
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
  const url = new URL(`${origin}/xrpc/app.citruswallet.${method}`);
  for (const [key, value] of Object.entries(params ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const response = await fetch(url.toString(), {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    headers: {
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
