import { formatAmount } from "./format";
import type { Session } from "./types";
import type { WalletBalances } from "./wallet";

export function balanceOf(
  address: string,
  session: Session,
  balances: WalletBalances | undefined,
) {
  const wei = balances?.wei[address.toLowerCase()];
  return wei === undefined ? null : formatAmount(wei, session.network.nativeCurrency);
}

/* What this DID holds across the wallets it has linked on the active chain. */
export function accountBalance(
  session: Session,
  balances: WalletBalances | undefined,
) {
  const linked = session.links.filter(
    (link) => link.chain_id === session.network.chainId,
  );
  const known = linked.filter(
    (link) => balances?.wei[link.address.toLowerCase()] !== undefined,
  );
  if (!known.length) return null;
  const total = known.reduce(
    (sum, link) => sum + BigInt(balances!.wei[link.address.toLowerCase()]!),
    0n,
  );
  const where =
    known.length === linked.length
      ? `${known.length} linked address${known.length === 1 ? "" : "es"}`
      : `${known.length} of ${linked.length} linked addresses`;
  return `${formatAmount(total.toString(), session.network.nativeCurrency)} across ${where}`;
}
