let waiting: { resolve: () => void; reject: (error: Error) => void } | null = null;
const listeners = new Set<() => void>();
export const unlockSnapshot = () => Boolean(waiting);
export function subscribeUnlock(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function finishUnlock(success: boolean) {
  const request = waiting; waiting = null; for (const listener of listeners) listener();
  if (success) request?.resolve(); else request?.reject(Object.assign(new Error('Wallet unlock cancelled.'), { code: 4001 }));
}
export function requestUnlock(): Promise<void> {
  if (waiting) return Promise.reject(new Error('Finish unlocking your wallet first.'));
  return new Promise((resolve, reject) => { waiting = { resolve, reject }; for (const listener of listeners) listener(); });
}
