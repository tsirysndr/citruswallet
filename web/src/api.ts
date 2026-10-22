/* Wallet keys and OAuth/session credentials never enter browser storage. */
let csrf = "";

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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error ?? "Request failed.");
  return data as T;
}

export const send = <T>(path: string, body: unknown = {}): Promise<T> =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });

export const remove = <T>(path: string): Promise<T> => api<T>(path, { method: "DELETE" });
