import type { Actor, Currency, PaymentState } from "./types";

export const stateLabels: Record<PaymentState, string> = {
  waiting: "Awaiting recipient setup",
  ready: "Ready for review",
  prepared: "Prepared · awaiting wallet approval",
  submitted: "Submitted · checking chain",
  confirming: "Confirming",
  confirmed: "Confirmed",
  failed: "Transaction verification failed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const label = (state: PaymentState) => stateLabels[state] ?? state;

export function formatUnits(wei: string, decimals: number, places = 6) {
  const unit = 10n ** BigInt(decimals);
  const value = BigInt(wei);
  const fraction = (value % unit)
    .toString()
    .padStart(decimals, "0")
    .slice(0, places)
    .replace(/0+$/, "");
  return fraction ? `${value / unit}.${fraction}` : `${value / unit}`;
}

export function formatAmount(wei: string, currency: Currency) {
  // Group the integer as text to preserve precision for large balances.
  const [whole, fraction] = formatUnits(wei, currency.decimals).split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}${fraction ? `.${fraction}` : ""} ${currency.symbol}`;
}

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

export function initials(actor: Pick<Actor, "did" | "handle" | "displayName">) {
  const source =
    actor.displayName || actor.handle || actor.did.replace(/^did:[a-z]+:/, "");
  return ([...source][0] ?? "?").toUpperCase();
}

/* Kept inside the palette's own arc, from orange through yellow to teal. */
export function avatarHue(did: string) {
  let hash = 0;
  for (const character of did) hash = (hash * 31 + character.codePointAt(0)!) % 151;
  return 20 + hash;
}
