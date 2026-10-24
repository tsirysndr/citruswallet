import { useTheme } from '../../theme';
import { Pressable, View } from "react-native";
import { Text } from "../Typography";
import { Ionicons } from "@expo/vector-icons";
import { editAmount } from "../../amount";
export function AmountPad({
  value,
  onChange,
  decimals = 18,
  symbol = "ETH",
  compact = false,
}: {
  value: string;
  decimals?: number;
  symbol?: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className={compact ? "gap-2" : "gap-4"}>
      <View className={`${compact ? "min-h-20" : "min-h-32"} items-center justify-center gap-2 px-2`}>
        <Text
          accessibilityLabel={`Amount ${value} ${symbol}`}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{ fontVariant: ["tabular-nums"] }}
          className="text-5xl font-semibold text-ink"
        >
          {value}
        </Text>
        <Text className="text-base text-muted">{symbol}</Text>
      </View>
      <View className="flex-row flex-wrap">
        {[
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          ".",
          "0",
          "backspace",
        ].map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={
              key === "backspace"
                ? "Delete last digit"
                : key === "."
                  ? "Decimal separator"
                  : key
            }
            onPress={() => onChange(editAmount(value, key, decimals))}
            onLongPress={key === "backspace" ? () => onChange("0") : undefined}
            className={`${compact ? "h-12" : "h-16"} w-1/3 items-center justify-center rounded-xl active:bg-surface`}
          >
            {key === "backspace" ? (
              <Ionicons name="backspace-outline" size={26} color={colors.ink} />
            ) : (
              <Text className="text-3xl font-medium text-ink">{key}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
