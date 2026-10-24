import { Pressable } from "react-native";
import { useAtomValue } from "jotai";
import { busyAtom } from "../../state";
import { Text } from "../Typography";
export function Button({
  title,
  onPress,
  disabled = false,
  keepEnabled = false,
  tone = "lime",
  multiline = false,
}: {
  title: string;
  multiline?: boolean;
  onPress: () => void;
  disabled?: boolean;
  keepEnabled?: boolean;
  tone?: "lime" | "plain" | "dark" | "black" | "ghost";
}) {
  const busy = useAtomValue(busyAtom);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ alignSelf: "stretch", minHeight: 48 }}
      disabled={disabled || (!keepEnabled && busy)}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-lg px-4 py-3 ${tone === "black" ? "bg-black" : tone === "dark" ? "bg-ink" : tone === "ghost" ? "bg-transparent" : tone === "plain" ? "bg-white" : "bg-accent"} ${(disabled || (!keepEnabled && busy)) && tone !== "black" ? "opacity-40" : ""}`}
    >
      <Text
        numberOfLines={multiline ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ width: "100%", textAlign: "center", lineHeight: 26, includeFontPadding: true, flexShrink: 0 }}
        className={`text-base font-semibold ${tone === "dark" || tone === "black" ? "text-white" : "text-ink"}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
