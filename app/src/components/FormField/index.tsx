import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { View, type TextInputProps } from "react-native";
import { Field } from "../ui";
import { Text } from "../Typography";
export function FormField<T extends FieldValues>({
  control,
  name,
  ...props
}: TextInputProps & { control: Control<T>; name: Path<T>; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-1">
          <Field
            {...props}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
          {fieldState.error && (
            <Text accessibilityRole="alert" className="text-sm text-red-700">
              {fieldState.error.message}
            </Text>
          )}
        </View>
      )}
    />
  );
}
