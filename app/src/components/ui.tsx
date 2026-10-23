import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useAtomValue } from "jotai";
import { busyAtom } from "../state";
import type { Actor } from "../types";
export function Button({
  title,
  onPress,
  disabled = false,
  tone = "lime",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "lime" | "plain" | "dark";
}) {
  const busy = useAtomValue(busyAtom);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-lg px-4 py-3 ${tone === "dark" ? "bg-ink" : tone === "plain" ? "bg-white" : "bg-accent"} ${disabled || busy ? "opacity-40" : ""}`}
    >
      <Text
        className={`text-base font-semibold ${tone === "dark" ? "text-white" : "text-ink"}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="gap-2">
      <Text className="text-sm text-muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#696b63"
        {...props}
        className="rounded-lg border border-edge bg-white p-3 text-base text-ink"
      />
    </View>
  );
}
export function Avatar({ actor }: { actor?: Actor | null }) {
  return actor?.avatar ? (
    <Image
      accessibilityLabel={`${actor.displayName || actor.handle} avatar`}
      source={{ uri: actor.avatar }}
      className="h-11 w-11 rounded-full"
    />
  ) : (
    <View className="h-11 w-11 items-center justify-center rounded-full bg-lilac">
      <Text className="text-lg font-bold">
        {(actor?.displayName || actor?.handle || "@").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
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
export function Empty({ text }: { text: string }) {
  return <Text className="py-8 text-center text-base text-muted">{text}</Text>;
}
