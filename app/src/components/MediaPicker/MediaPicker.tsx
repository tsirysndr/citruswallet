import { ContentSkeleton } from "../ContentSkeleton";
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Text, TextInput } from '../Typography';
import { Button } from '../ui';
import { fetchMedia, klipyEnabled, mediaKinds, type MediaKind } from '../../klipy';
import type { PaymentMedia } from '../../types';

export function MediaPicker({ value, onChange }: { value: PaymentMedia | null; onChange: (media: PaymentMedia | null) => void }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState<MediaKind>('gifs');
  const [input, setInput] = useState(''), [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(input.trim()), 250); return () => clearTimeout(timer); }, [input]);
  const results = useInfiniteQuery({
    queryKey: ['klipy', kind, search], enabled: open && klipyEnabled,
    initialPageParam: 1, queryFn: ({ pageParam, signal }) => fetchMedia(kind, search, pageParam, signal),
    getNextPageParam: (last, pages) => last.hasNext ? pages.length + 1 : undefined,
  });
  const items = results.data?.pages.flatMap(page => page.items).flatMap(item => item.media ? [item.media] : []) || [];
  return <View className="gap-3">
    {value && <View className="gap-2 rounded-xl bg-white p-3">
      <Image source={{ uri: value.preview }} style={{ height: 150, width: '100%' }} contentFit="contain" accessibilityLabel={value.title} />
      <Button title="Remove attachment" tone="plain" onPress={() => onChange(null)} />
    </View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Add GIF, sticker, meme or clip" onPress={() => setOpen(true)}
      className="h-12 w-12 items-center justify-center rounded-lg">
      <Ionicons name="images-outline" size={25} color="#191916" /><Text className="text-xs font-bold">GIF</Text>
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="gap-4 p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold">Add a little personality</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close media picker" onPress={() => setOpen(false)} className="h-12 w-12 items-center justify-center">
              <Ionicons name="close" size={28} color="#191916" />
            </Pressable>
          </View>
          <TextInput accessibilityLabel="Search media" placeholder="Search KLIPY" value={input} onChangeText={setInput}
            className="rounded-lg border border-edge bg-white p-3 text-base" />
          <View className="flex-row gap-2">{mediaKinds.map(item => <Pressable key={item.value} accessibilityRole="tab"
            accessibilityState={{ selected: kind === item.value }} onPress={() => setKind(item.value)}
            className={`flex-1 items-center rounded-lg py-3 ${kind === item.value ? 'bg-accent' : 'bg-white'}`}>
            <Text className="text-sm font-medium">{item.label}</Text>
          </Pressable>)}</View>
          <Text className="text-sm text-muted">Powered by KLIPY</Text>
          {!klipyEnabled && <Text>Media search is not configured for this build.</Text>}
          {results.isError && <Button title="Could not load media. Try again" tone="ghost" onPress={() => void results.refetch()} />}
        </View>
        <FlatList data={items} numColumns={2} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          keyExtractor={(item, index) => `${item.slug}-${index}`} onEndReached={() => { if (results.hasNextPage && !results.isFetching) void results.fetchNextPage(); }}
          ListEmptyComponent={results.isFetching ? <ContentSkeleton variant="media" label="Loading media" /> : <Text className="p-5 text-center text-muted">No results yet.</Text>}
          ListFooterComponent={results.isFetchingNextPage ? <ContentSkeleton variant="media" label="Loading more media" /> : null}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Attach ${item.title}`} style={{ width: '50%', padding: 4 }}
            onPress={() => { onChange(item); setOpen(false); }}>
            <Image source={{ uri: item.preview }} style={{ height: 140, borderRadius: 8 }} contentFit="cover" />
          </Pressable>} />
      </SafeAreaView>
    </Modal>
  </View>;
}
