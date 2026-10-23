import { View } from 'react-native';
import { HandleInput } from '../../components/HandleInput';
import { Avatar, Button } from '../../components/ui';
import { Text } from '../../components/Typography';
import type { Actor } from '../../types';

export function RecipientStep({ handle, actor, ownDid, onChange, onSelect, onContinue }: {
  handle: string; actor: Actor | null; ownDid: string; onChange: (value: string) => void;
  onSelect: (actor: Actor) => void; onContinue: () => void;
}) {
  return <View className="gap-5">
    <HandleInput label="Recipient handle" value={handle} onChange={onChange} onSelect={onSelect} excludeDid={ownDid} />
    {actor && <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4">
      <Avatar actor={actor} /><View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-lg font-semibold">{actor.displayName || actor.handle}</Text>
        <Text numberOfLines={1} className="font-mono text-sm text-muted">@{actor.handle}</Text>
      </View>
    </View>}
    <Button title="Continue" disabled={!handle.trim()} onPress={onContinue} />
  </View>;
}
