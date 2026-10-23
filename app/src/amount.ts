// String-only editing avoids floating point rounding in ETH amounts.
export function editAmount(current: string, key: string): string {
  if (key === "backspace") return current.slice(0, -1) || "0";
  if (key === "," || key === ".")
    return current.includes(".") ? current : `${current}.`;
  if (!/^\d$/.test(key)) return current;
  const fraction = current.split(".")[1];
  if (fraction && fraction.length >= 18) return current;
  if (current.replace(".", "").length >= 36) return current;
  return current === "0" ? key : current + key;
}
export function amountWei(value: string): bigint {
  if (!/^\d+(\.\d{0,18})?$/.test(value))
    throw new Error("Enter a valid ETH amount.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}
export function formatWei(value: bigint): string {
  const whole = value / 10n ** 18n,
    fraction = (value % 10n ** 18n)
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "");
  return whole.toLocaleString("en-US") + (fraction ? "." + fraction : "");
}
