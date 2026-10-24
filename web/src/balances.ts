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
export function accountBalanceDetails(
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
    return { wei: '0', count: 0 };
  }
  // An unavailable address must never be silently counted as zero.
  if (addresses.some(address => balances?.wei[address] === undefined)) return null;
  const total = addresses.reduce((sum, address) => sum + BigInt(balances!.wei[address]!), 0n);
  return { wei: total.toString(), count: addresses.length };
}

export function accountBalance(session: Session, balances: WalletBalances | undefined) {
  const total = accountBalanceDetails(session, balances);
  if (!total) return null;
  return `${formatAmount(total.wei, session.network.nativeCurrency)} across ${total.count} address${total.count === 1 ? '' : 'es'}${total.count === 0 ? ' on this network' : ''}`;
}
