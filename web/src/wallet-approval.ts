export type WalletApproval = { network: string; to: string; value: string; fee: string; nonce: number; token: boolean };
let current: WalletApproval | null = null;
let finish: ((approved: boolean) => void) | null = null;
const listeners = new Set<() => void>();
export const approvalSnapshot = () => current;
export function subscribeApproval(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function answerApproval(approved: boolean) {
  const callback = finish; finish = null; current = null;
  for (const listener of listeners) listener();
  callback?.(approved);
}
export function requestApproval(details: WalletApproval): Promise<boolean> {
  if (current) throw new Error('Finish the current wallet request first.');
  return new Promise(resolve => { current = details; finish = resolve; for (const listener of listeners) listener(); });
}
