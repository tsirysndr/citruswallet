import { atom } from "jotai";

export type Status = { message: string; error: boolean };

export const statusAtom = atom<Status>({ message: "", error: false });
export const busyAtom = atom(false);
export const reviewIdAtom = atom<string | null>(null);
export const acknowledgedAtom = atom(false);
export const invitationUrlAtom = atom<string | null>(null);

const inviteKey = "citruswallet-invite";

function openingInvite(): string | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get("invite");
  if (fragment && /^[a-f0-9]{64}$/.test(fragment)) {
    sessionStorage.setItem(inviteKey, fragment);
    window.history.replaceState(null, "", "/wallet");
  }
  return sessionStorage.getItem(inviteKey);
}

/* Someone arriving on an invitation link lands where they can answer it. */
export const inviteTokenAtom = atom<string | null>(openingInvite());

export const forgetInvite = () => sessionStorage.removeItem(inviteKey);
