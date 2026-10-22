import { History, Send, UserRound, Wallet } from "lucide-react";

export const screens = [
  { to: "/", icon: UserRound, label: "Account" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/payments", icon: Send, label: "Payments" },
  { to: "/activity", icon: History, label: "Activity" },
] as const;

export type Screen = (typeof screens)[number]["to"];
