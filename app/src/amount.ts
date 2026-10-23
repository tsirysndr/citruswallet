import { parseAmount, formatBalance } from "@citruswallet/amounts";
export { editAmount } from "@citruswallet/amounts";
export function amountWei(value: string): bigint {
  const normalized = value.replace(/\.$/, "");
  if (/^0(?:\.0*)?$/.test(normalized)) return 0n;
  return BigInt(parseAmount(normalized, 18));
}
export function formatWei(value: bigint): string {
  return formatBalance(value.toString(), 18);
}
