import { useTheme } from "../../theme";
import { useState } from "react";
import { Pressable, View, type TextInputProps } from "react-native";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import { Text, TextInput } from "../Typography";
export function Field({
  label,
  secureTextEntry,
  ...props
}: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View className="gap-2">
      <Text className="text-sm text-muted">{label}</Text>
      <View className="flex-row items-center rounded-lg border border-edge bg-surface">
        {secureTextEntry && (
          <View className="pl-3" accessible={false}>
            <LockKeyhole size={18} color={colors.muted} />
          </View>
        )}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#696b63"
          returnKeyType={props.multiline ? undefined : "done"}
          {...props}
          secureTextEntry={secureTextEntry && !visible}
          className="min-h-12 min-w-0 flex-1 p-3 text-base text-ink"
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            accessibilityState={{
              disabled: props.editable === false,
              selected: visible,
            }}
            disabled={props.editable === false}
            onPress={() => setVisible((value) => !value)}
            className="min-h-12 min-w-12 items-center justify-center"
          >
            {visible ? (
              <EyeOff size={20} color={colors.muted} />
            ) : (
              <Eye size={20} color={colors.muted} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
