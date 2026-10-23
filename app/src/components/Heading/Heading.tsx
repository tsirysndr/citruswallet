import { View } from "react-native";
import { Text } from "../Typography";
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-2 gap-2">
      <Text className="text-3xl font-semibold text-ink">{title}</Text>
      {subtitle && <Text className="text-base text-muted">{subtitle}</Text>}
    </View>
  );
}
