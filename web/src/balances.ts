import { localBalanceAddress, localWalletState } from "./local-wallet";
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
  if (balances?.unavailable) return null;
  const addresses = [...new Set([
    ...session.links.filter(link => link.chain_id === session.network.chainId).map(link => link.address.toLowerCase()),
    ...(balances?.address ? [balances.address.toLowerCase()] : []),
    ...(localBalanceAddress() ? [localBalanceAddress()!.toLowerCase()] : []),
  ])];
  if (!addresses.length) {
    if (localWalletState() !== 'absent') return null;
    return `${formatAmount('0', session.network.nativeCurrency)} across 0 addresses on this network`;
  }
  // An unavailable address must never be silently counted as zero.
  if (addresses.some(address => balances?.wei[address] === undefined)) return null;
  const total = addresses.reduce((sum, address) => sum + BigInt(balances!.wei[address]!), 0n);
  return `${formatAmount(total.toString(), session.network.nativeCurrency)} across ${addresses.length} address${addresses.length === 1 ? '' : 'es'}`;
}
