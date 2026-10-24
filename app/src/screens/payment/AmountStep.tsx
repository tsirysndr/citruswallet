import { Pressable, View } from "react-native";
import { AmountPad } from "../../components/AmountPad";
import { Avatar, Button } from "../../components/ui";
import { Text } from "../../components/Typography";
import { parseAmount } from "@peachlet/amounts";
import type { ReactNode } from "react";
import type { Actor } from "../../types";

export function AmountStep({
  actor,
  handle,
  amount,
  onAmount,
  onContinue,
  decimals = 18,
  symbol = "ETH",
  assetPicker,
  usdMode = false,
  onUnitChange,
  conversion,
  conversionPending,
  conversionError,
  onRefreshRate,
}: {
  usdMode?: boolean;
  onUnitChange?: (usd: boolean) => void;
  conversion?: string;
  conversionPending?: boolean;
  conversionError?: string;
  onRefreshRate?: () => void;
  decimals?: number;
  symbol?: string;
  assetPicker?: ReactNode;
  actor: Actor | null;
  handle: string;
  amount: string;
  onAmount: (value: string) => void;
  onContinue: () => void;
}) {
  let valid = false;
  try {
    parseAmount(amount.replace(/\.$/, ""), usdMode ? 2 : decimals);
    valid = !usdMode || !!conversion;
  } catch {}
  return (
    <View className="flex-1 gap-3">
      <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-3">
        <Avatar actor={actor} size={64} />
        <View className="min-w-0 flex-1">
          <Text className="text-sm text-muted">Sending to</Text>
          <Text numberOfLines={1} className="text-base font-semibold">
            {actor?.displayName || `@${handle}`}
          </Text>
          {actor?.displayName && (
            <Text numberOfLines={1} className="font-mono text-sm text-muted">
              @{actor.handle || handle}
            </Text>
          )}
        </View>
      </View>
      {assetPicker}
      {onUnitChange && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[false, true].map((usd) => (
            <Pressable
              key={String(usd)}
              accessibilityRole="button"
              accessibilityLabel={`Enter amount in ${usd ? "USD" : "ETH"}`}
              accessibilityState={{ selected: usdMode === usd }}
              onPress={() => onUnitChange(usd)}
              className={`min-h-10 flex-1 items-center justify-center rounded-lg ${usdMode === usd ? "bg-accent" : "bg-surface"}`}
            >
              <Text className="font-semibold">{usd ? "USD" : "ETH"}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <AmountPad
        compact
        value={amount}
        onChange={onAmount}
        decimals={usdMode ? 2 : decimals}
        symbol={usdMode ? "USD" : symbol}
        action={
          <View className="gap-2">
            {usdMode && (
              <>
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-center text-xs text-muted"
                >
                  {conversion ||
                    (conversionPending
                      ? "Loading ETH price…"
                      : conversionError ||
                        "Enter a USD amount with up to two decimal places.")}
                </Text>
                {!conversion && onRefreshRate && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Refresh exchange rate"
                    disabled={conversionPending}
                    onPress={onRefreshRate}
                  >
                    <Text className="text-center text-sm font-semibold">
                      Refresh exchange rate
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            <Button title="Continue" disabled={!valid} onPress={onContinue} />
          </View>
        }
      />
    </View>
  );
}
