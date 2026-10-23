import { View } from 'react-native';
import { AmountPad } from '../../components/AmountPad';
import { Avatar, Button } from '../../components/ui';
import { Text } from '../../components/Typography';
import { parseAmount } from "@citruswallet/amounts";
import type { ReactNode } from "react";
import type { Actor } from '../../types';

export function AmountStep({ actor, handle, amount, onAmount, onContinue, decimals = 18, symbol = "ETH", assetPicker }: {
  decimals?: number; symbol?: string; assetPicker?: ReactNode;
  actor: Actor | null; handle: string; amount: string;
  onAmount: (value: string) => void; onContinue: () => void;
}) {
  let valid = false;
  try { parseAmount(amount.replace(/\.$/, ""), decimals); valid = true; } catch {}
  return <View className="gap-4">
    <View className="flex-row items-center gap-3 rounded-2xl bg-white p-3">
      <Avatar actor={actor} size={64} /><View className="min-w-0 flex-1">
        <Text className="text-sm text-muted">Sending to</Text>
        <Text numberOfLines={1} className="text-base font-semibold">{actor?.displayName || `@${handle}`}</Text>
        {actor?.displayName && <Text numberOfLines={1} className="font-mono text-sm text-muted">@{actor.handle || handle}</Text>}
      </View>
    </View>
    {assetPicker}
    <AmountPad value={amount} onChange={onAmount} decimals={decimals} symbol={symbol} />
    <Button title="Continue" disabled={!valid} onPress={onContinue} />
  </View>;
}
