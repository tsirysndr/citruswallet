import { Pressable, View } from "react-native";
import { Text } from "../Typography";
import { Ionicons } from "@expo/vector-icons";
import { editAmount } from "../../amount";
export function AmountPad({
  value,
  onChange,
  decimals = 18,
  symbol = "ETH",
}: {
  value: string;
  decimals?: number;
  symbol?: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="gap-4">
      <View className="min-h-32 items-center justify-center gap-2 px-2">
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
            className="h-16 w-1/3 items-center justify-center rounded-xl active:bg-white"
          >
            {key === "backspace" ? (
              <Ionicons name="backspace-outline" size={26} color="#191916" />
            ) : (
              <Text className="text-3xl font-medium text-ink">{key}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
