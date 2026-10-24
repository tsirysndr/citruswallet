import { useTheme } from "../../theme";
import {
  Platform,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
} from "react-native";

export function Text({
  className = "",
  style,
  ...props
}: TextProps & { className?: string }) {
  const fontFamily = /\bfont-mono\b/.test(className)
    ? Platform.OS === "ios"
      ? "Menlo"
      : "monospace"
    : /\bfont-(extrabold|bold|semibold)\b/.test(className)
      ? "RockfordBold"
      : /\bfont-medium\b/.test(className)
        ? "RockfordMedium"
        : "Rockford";
  return (
    <NativeText
      {...props}
      className={`${/\btext-(?:ink|muted|white|black|accent|blue|red|green|orange|peach|lilac)\b/.test(className) ? "" : "text-ink "}${className}`.replace(
        /\bfont-(extrabold|bold|semibold|medium|mono)\b/g,
        "",
      )}
      style={[
        {
          fontFamily,
          ...(/\bfont-mono\b/.test(className)
            ? {
                fontWeight: /\bfont-extrabold\b/.test(className)
                  ? ("800" as const)
                  : /\bfont-bold\b/.test(className)
                    ? ("700" as const)
                    : /\bfont-semibold\b/.test(className)
                      ? ("600" as const)
                      : ("400" as const),
              }
            : {}),
        },
        style,
      ]}
    />
  );
}
export function TextInput({
  style,
  placeholderTextColor,
  ...props
}: TextInputProps & { className?: string }) {
  const { colors } = useTheme();
  return (
    <NativeTextInput
      placeholderTextColor={
        placeholderTextColor === "#696b63"
          ? colors.muted
          : (placeholderTextColor ?? colors.muted)
      }
      {...props}
      style={[{ fontFamily: "Rockford" }, style]}
    />
  );
}
