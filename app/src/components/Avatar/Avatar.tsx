import { Image, View } from "react-native";
import type { Actor } from "../../types";
import { Text } from "../Typography";
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
