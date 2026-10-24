import { View } from "react-native";
import { Text } from "../Typography";
const colors = {
  waiting: { backgroundColor: "#fff0c2", color: "#795600" },
  ready: { backgroundColor: "#ddf4df", color: "#23613b" },
  prepared: { backgroundColor: "#d6f3f1", color: "#176364" },
  submitted: { backgroundColor: "#dce8ff", color: "#284ea0" },
  confirming: { backgroundColor: "#eaddff", color: "#664098" },
  confirmed: { backgroundColor: "#ffb995", color: "#315417" },
  failed: { backgroundColor: "#ffe0db", color: "#a12d25" },
  cancelled: { backgroundColor: "#f4ddeb", color: "#85365e" },
  expired: { backgroundColor: "#ffdfc1", color: "#864713" },
};
export function PaymentStatus({ state }: { state: string }) {
  const palette = colors[state as keyof typeof colors] ?? { backgroundColor: "#f7f3f0", color: "#696b63" };
  return <View style={{ alignSelf: "flex-start", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: palette.backgroundColor }}>
    <Text className="text-sm font-medium" style={{ color: palette.color }}>{state.charAt(0).toUpperCase() + state.slice(1)}</Text>
  </View>;
}
