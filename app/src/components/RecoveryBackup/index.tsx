import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { recoveryChallenge } from '@citruswallet/wallet-core';
import { Text } from '../Typography';
import { Button } from '../ui';

export function RecoveryBackup({ phrase, onConfirmed, onCancel, allowWhileBusy = false }: {
  onCancel?: () => void; phrase: string; onConfirmed: (confirmed: boolean) => void; allowWhileBusy?: boolean;
}) {
  const [prompts] = useState(() => recoveryChallenge(phrase));
  const [columns, setColumns] = useState(3);
  const [checking, setChecking] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [active, setActive] = useState(0), [error, setError] = useState('');
  const words = phrase.split(' '), current = prompts[active]!;
  const complete = prompts.every(prompt => answers[prompt.index] === words[prompt.index]);
  const choose = (word: string) => {
    if (word !== words[current.index]) { setError('Not quite. Check your backup and pick another word.'); return; }
    const next = { ...answers, [current.index]: word }; setAnswers(next); setError('');
    const missing = prompts.findIndex(prompt => next[prompt.index] !== words[prompt.index]);
    if (missing === -1) onConfirmed(true); else setActive(missing);
  };
  return <View className="gap-4">
    <Text className="text-sm text-muted">{checking ? 'Just 3 words to check. The other 9 are filled in for you.' : 'Write these 12 words down privately, in order. Keep your backup somewhere safe. Anyone with these words can use your funds.'}</Text>
    <View className="flex-row flex-wrap" style={{ gap: 8 }} onLayout={event => setColumns(event.nativeEvent.layout.width < 300 ? 2 : 3)}>
      {words.map((word, index) => {
        const prompt = prompts.findIndex(item => item.index === index), missing = checking && prompt !== -1;
        const content = <><Text className="text-xs text-muted">{index + 1}.</Text><Text numberOfLines={1} adjustsFontSizeToFit className="text-sm">{missing ? answers[index] || '•••' : word}</Text></>;
        return missing ? <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Choose word ${index + 1}`} accessibilityState={{ selected: !complete && active === prompt }}
          style={{ width: columns === 2 ? '48%' : '30%', minHeight: 48 }} className={`items-start gap-1 rounded-md border px-2 py-3 ${!complete && active === prompt ? 'border-ink bg-accent' : 'border-edge bg-canvas'}`}
          onPress={() => { setActive(prompt); setAnswers(previous => { const next = { ...previous }; delete next[index]; return next; }); setError(''); onConfirmed(false); }}>{content}</Pressable>
          : <View key={index} style={{ width: columns === 2 ? '48%' : '30%', minHeight: 48 }} className="items-start gap-1 rounded-md bg-canvas px-2 py-3">{content}</View>;
      })}
    </View>
    {!checking ? <View className="flex-row items-center gap-3">{onCancel && <View className="flex-1"><Button keepEnabled={allowWhileBusy} title="Cancel" tone="ghost" onPress={onCancel} /></View>}<View className="flex-[2]"><Button multiline keepEnabled={allowWhileBusy} title="I’ve saved my recovery phrase" onPress={() => { setChecking(true); onConfirmed(false); }} /></View></View> : <>
      <Text accessibilityLiveRegion="polite" className="font-semibold">{complete ? 'Backup confirmed. You’re ready to save your wallet.' : `${Object.keys(answers).length} of 3 confirmed · Choose word ${current.index + 1}`}</Text>
      {!complete && <View testID="recovery-word-choices" className="flex-row flex-wrap" style={{ gap: 8 }} onLayout={event => setColumns(event.nativeEvent.layout.width < 300 ? 2 : 3)}>{current.choices.map(word => <View key={`${current.index}:${word}`} style={{ width: '48%' }}><Button keepEnabled={allowWhileBusy} title={word} tone="plain" onPress={() => choose(word)} /></View>)}</View>}
      {!!error && <Text accessibilityRole="alert" className="text-red-700">{error}</Text>}
      <View className="flex-row items-center gap-3">{onCancel && <View className="flex-1"><Button keepEnabled={allowWhileBusy} title="Cancel" tone="ghost" onPress={onCancel} /></View>}<View className="flex-[2]"><Button multiline keepEnabled={allowWhileBusy} title="Review my recovery phrase" tone="ghost" onPress={() => { setChecking(false); setAnswers({}); setActive(0); setError(''); onConfirmed(false); }} /></View></View>
    </>}
  </View>;
}
