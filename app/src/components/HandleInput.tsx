import { useEffect, useState } from 'react';
import { Pressable, View } from "react-native";
import { Text, TextInput } from "./Typography";
import { useQuery } from '@tanstack/react-query';
import type { Actor } from '../types';
import { useAtomValue } from 'jotai';
import { busyAtom } from '../state';
import { Avatar } from './ui';

export function HandleInput({ value, onChange, onSelect, excludeDid, label = 'Handle' }: {
  value: string; onChange: (value: string) => void;
  onSelect?: (actor: Actor) => void; excludeDid?: string; label?: string;
}) {
  const busy = useAtomValue(busyAtom);
  const [focused, setFocused] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const normalized = value.trim().replace(/^@+/, '');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(normalized), 250);
    return () => clearTimeout(timer);
  }, [normalized]);
  const { data, isFetching, error } = useQuery({
    queryKey: ['login-handles', search],
    enabled: focused && search === normalized && search.length >= 2 && search.length <= 64 && !search.startsWith('did:') && selected !== normalized,
    queryFn: async ({ signal }): Promise<Actor[]> => {
      // Public profile lookup works before the native OAuth session exists.
      const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead');
      url.searchParams.set('q', search);
      url.searchParams.set('limit', '6');
      const response = await fetch(url.toString(), { signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Suggestions unavailable');
      const result = await response.json();
      return Array.isArray(result.actors) ? result.actors.filter((actor: Actor) => typeof actor.did === 'string' && typeof actor.handle === 'string') : [];
    },
    retry: false,
    staleTime: 60000,
  });
  const actors = data?.filter(actor => actor.did !== excludeDid) || [];
  const show = focused && normalized === search && normalized !== selected && normalized.length >= 2 && !normalized.startsWith('did:');
  return <View className="gap-2">
    <Text className="text-sm text-muted">{label}</Text>
    <View className="flex-row items-center rounded-lg border border-edge bg-white px-3">
      <Text accessible={false} className="mr-2 text-2xl text-muted">@</Text>
      <TextInput accessibilityLabel={label} placeholder="you.bsky.social" placeholderTextColor="#696b63"
        editable={!busy} value={value} onChangeText={text => { setSelected(''); onChange(text.replace(/^@+/, '')); }}
        autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username"
        keyboardType="email-address" returnKeyType="done" maxLength={253}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="min-h-12 flex-1 py-3 text-base text-ink" />
    </View>
    {show && !!actors.length && <View className="overflow-hidden rounded-lg border border-edge bg-white">
      {actors.map(actor => <Pressable key={actor.did} accessibilityRole="button" accessibilityLabel={`Use @${actor.handle}`}
        disabled={busy} onPress={() => { setSelected(actor.handle); onChange(actor.handle); onSelect?.(actor); }} className="flex-row items-center gap-3 px-3 py-2">
        <Avatar actor={actor} /><View className="flex-1"><Text numberOfLines={1} className="font-semibold text-ink">{actor.displayName || actor.handle}</Text><Text numberOfLines={1} className="text-sm text-muted">@{actor.handle}</Text></View>
      </Pressable>)}
    </View>}
    {show && isFetching && <Text className="text-sm text-muted">Finding handles…</Text>}
    {show && error && <Text className="text-sm text-muted">Suggestions are unavailable. You can still enter your full handle.</Text>}
  </View>;
}
