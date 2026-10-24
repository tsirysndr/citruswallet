/* A transaction that MetaMask may have broadcast before the page lost the
   response. It is remembered so a reload cannot turn one transfer into two. */
export type Pending = { id: string; attemptId: string; txHash?: string };

const key = (did: string) => `peachlet-broadcast:${did}`;

export function pendingBroadcast(did: string): Pending | null {
  const saved = sessionStorage.getItem(key(did));
  return saved ? (JSON.parse(saved) as Pending) : null;
}

export const rememberBroadcast = (did: string, pending: Pending) =>
  sessionStorage.setItem(key(did), JSON.stringify(pending));

export const forgetBroadcast = (did: string) =>
  sessionStorage.removeItem(key(did));
