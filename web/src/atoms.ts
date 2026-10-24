import type { UsdEthQuote } from '@peachlet/amounts';
import { atom } from "jotai";

export type Status = { message: string; error: boolean };

export const statusAtom = atom<Status>({ message: "", error: false });
export const busyAtom = atom(false);
export const reviewIdAtom = atom<string | null>(null);
export const acknowledgedAtom = atom(false);
export const invitationUrlAtom = atom<string | null>(null);

const inviteKey = "peachlet-invite";

function openingInvite(): string | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get("invite");
  if (fragment && /^[a-f0-9]{64}$/.test(fragment)) {
    const chain = new URLSearchParams(window.location.search).get("chainId") || "1";
    if (["1", "4326", "6343", "31337"].includes(chain)) localStorage.setItem("citrus:chain", chain);
    sessionStorage.setItem(inviteKey, fragment);
    window.history.replaceState(null, "", "/wallet");
  }
  return sessionStorage.getItem(inviteKey);
}

/* Someone arriving on an invitation link lands where they can answer it. */
export const inviteTokenAtom = atom<string | null>(openingInvite());

export const forgetInvite = () => sessionStorage.removeItem(inviteKey);

export const paymentUsdQuoteAtom = atom<(UsdEthQuote & { id: string; assetId: string; senderDid: string }) | null>(null);
