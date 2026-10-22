import { AtpBaseClient } from "./lexicon";
import { XRPCError } from "@atproto/xrpc";

/* Wallet keys and OAuth/session credentials never enter browser storage. */
let csrf = "";
const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => { unauthorizedListeners.delete(listener); };
}

export function rememberCsrf(token: string) {
  csrf = token;
}

export class RequestError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

const client = new AtpBaseClient(async (path, init) => {
  const headers = new Headers(init?.headers);
  headers.set("x-csrf-token", csrf);
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (response.status === 401) {
    for (const listener of unauthorizedListeners) listener();
  }
  return response;
}).app.citruswallet;

type DataClient<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => Promise<unknown> ? K : never]:
    T[K] extends (...args: infer A) => Promise<{ data: infer D }>
      ? (...args: A) => Promise<D> : never;
};

// Keep generated parameter/result types while unwrapping XRPC's response
// envelope and retaining the app's existing session-expiry error handling.
export const rpc = new Proxy(client, {
  get(target, key) {
    const method = Reflect.get(target, key);
    if (typeof method !== "function") return method;
    return async (...args: unknown[]) => {
      try { return (await method.apply(target, args)).data; }
      catch (error) {
        if (error instanceof XRPCError) throw new RequestError(error.message, error.status);
        throw error;
      }
    };
  },
}) as unknown as DataClient<typeof client>;
