import { View } from 'react-native';
import { AmountPad } from '../../components/AmountPad';
import { Avatar, Button } from '../../components/ui';
import { Text } from '../../components/Typography';
import { amountWei } from '../../amount';
import type { Actor } from '../../types';

export function AmountStep({ actor, handle, amount, onAmount, onContinue }: {
  actor: Actor | null; handle: string; amount: string;
  onAmount: (value: string) => void; onContinue: () => void;
}) {
  return <View className="gap-4">
    <View className="flex-row items-center gap-3 rounded-2xl bg-white p-3">
      <Avatar actor={actor} size={64} /><View className="min-w-0 flex-1">
        <Text className="text-sm text-muted">Sending to</Text>
        <Text numberOfLines={1} className="text-base font-semibold">{actor?.displayName || `@${handle}`}</Text>
        {actor?.displayName && <Text numberOfLines={1} className="font-mono text-sm text-muted">@{actor.handle || handle}</Text>}
      </View>
    </View>
    <AmountPad value={amount} onChange={onAmount} />
    <Button title="Continue" disabled={amountWei(amount) === 0n} onPress={onContinue} />
  </View>;
}
