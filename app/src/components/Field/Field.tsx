import { View, type TextInputProps } from "react-native";
import { Text, TextInput } from "../Typography";
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
