import { View } from "react-native";
import { HandleInput } from "../../components/HandleInput";
import type { Actor } from "../../types";

export function RecipientStep({
  handle,
  ownDid,
  onChange,
  onSelect,
  onSubmit,
  compact = false,
}: {
  handle: string;
  ownDid: string;
  onChange: (value: string) => void;
  onSelect: (actor: Actor) => void;
  onSubmit: () => void;
  compact?: boolean;
}) {
  return (
    <View>
      <HandleInput
        label="Recipient handle"
        value={handle}
        onChange={onChange}
        onSelect={onSelect}
        excludeDid={ownDid}
        onSubmit={onSubmit}
        hideLabel={compact}
      />
    </View>
  );
}
