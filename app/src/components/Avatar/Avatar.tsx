import { Image, View } from "react-native";
import type { Actor } from "../../types";
import { Text } from "../Typography";
export function Avatar({
  actor,
  size = 44,
}: {
  actor?: Actor | null;
  size?: number;
}) {
  return actor?.avatar ? (
    <Image
      accessibilityLabel={`${actor.displayName || actor.handle} avatar`}
      source={{ uri: actor.avatar }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-lilac"
    >
      <Text className="text-lg font-bold">
        {(actor?.displayName || actor?.handle || "@").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
