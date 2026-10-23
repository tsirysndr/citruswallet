import { atom } from "jotai";
export type Screen = "Account" | "Wallet" | "Payments" | "Activity";
export const screenAtom = atom<Screen>("Account");
export const reviewAtom = atom<string | null>(null);
export const noticeAtom = atom("");
export const busyAtom = atom(false);
export const readyAtom = atom(false);
