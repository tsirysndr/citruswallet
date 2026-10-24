import { View } from 'react-native';
import { Button } from '../../components/ui';
import { Text, TextInput } from '../../components/Typography';
import { MediaPicker } from '../../components/MediaPicker';
import type { PaymentMedia } from '../../types';

export function DescriptionStep({ description, media, onDescription, onMedia, onReview }: {
  description: string; media: PaymentMedia | null;
  onDescription: (value: string) => void; onMedia: (media: PaymentMedia | null) => void;
  onReview: () => void;
}) {
  return <View className="gap-5">
    <Text className="text-sm text-muted">Description (optional)</Text>
    <View testID="description-composer" className="relative gap-3 rounded-xl border border-edge bg-surface p-3">
      <TextInput accessibilityLabel="Description (optional)" value={description} onChangeText={onDescription}
        maxLength={500} multiline textAlignVertical="top" style={{ minHeight: 160 }}
        className="text-base text-ink" placeholderTextColor="#696b63" placeholder="What's this payment for?" />
      <MediaPicker value={media} onChange={onMedia} />
      <Text className="absolute bottom-6 right-4 text-xs text-muted">{description.length}/500</Text>
    </View>
    <Text className="text-sm text-muted">Only you and the recipient can see this note and attachment in Peachlet.</Text>
    <Button title="Review payment" onPress={onReview} />
  </View>;
}
