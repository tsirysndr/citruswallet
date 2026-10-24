import { useEffect, useRef, useState } from 'react';
import { recoveryChallenge } from '@peachlet/wallet-core';
import { Button, Hint } from '../ui';

export function RecoveryBackup({ phrase, onConfirmed, onCancel, allowWhileBusy = false }: {
  onCancel?: () => void; phrase: string; onConfirmed: (confirmed: boolean) => void; allowWhileBusy?: boolean;
}) {
  const [prompts] = useState(() => recoveryChallenge(phrase));
  const [checking, setChecking] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const words = phrase.split(' ');
  const complete = prompts.every(prompt => answers[prompt.index] === words[prompt.index]);
  const current = prompts[active]!;
  const choices = useRef<HTMLDivElement>(null);
  useEffect(() => { if (checking && !complete) choices.current?.querySelector("button")?.focus(); }, [checking, active, complete]);
  const review = () => { setChecking(false); setAnswers({}); setActive(0); setError(''); onConfirmed(false); };
  const choose = (word: string) => {
    if (word !== words[current.index]) { setError('Not quite. Check your backup and pick another word.'); return; }
    const next = { ...answers, [current.index]: word };
    setAnswers(next); setError('');
    const missing = prompts.findIndex(prompt => next[prompt.index] !== words[prompt.index]);
    if (missing === -1) onConfirmed(true); else setActive(missing);
  };
  return <section aria-label="Recovery phrase backup" className="flex flex-col gap-4">
    <Hint>{checking ? 'Just 3 words to check. The other 9 are filled in for you.' : 'Write these 12 words down privately, in order. Keep your backup somewhere safe. Anyone with these words can use your funds.'}</Hint>
    <ol aria-label="Recovery words" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
      {words.map((word, index) => {
        const prompt = prompts.findIndex(item => item.index === index);
        const missing = checking && prompt !== -1;
        return <li key={index} className="min-w-0">
          {missing ? <button type="button" aria-label={`Choose word ${index + 1}`} aria-pressed={!complete && active === prompt}
            onClick={() => { setActive(prompt); setAnswers(previous => { const next = { ...previous }; delete next[index]; return next; }); setError(''); onConfirmed(false); }}
            className={`flex min-h-12 w-full flex-col items-start gap-1 rounded-md border px-2 py-3 text-sm ${!complete && active === prompt ? 'border-ink bg-accent' : 'border-edge bg-sunken'}`}>
            <span className="text-xs text-ink-muted">{index + 1}.</span><span className="font-sans">{answers[index] || '•••'}</span>
          </button> : <div className="flex min-h-12 flex-col items-start gap-1 rounded-md bg-sunken px-2 py-3 text-sm"><span className="text-xs text-ink-muted">{index + 1}.</span><span className="font-sans">{word}</span></div>}
        </li>;
      })}
    </ol>
    {!checking ? <div className="flex items-center justify-end gap-3">{onCancel && <Button keepEnabled={allowWhileBusy} variant="subtle" className="!bg-transparent" onClick={onCancel}>Cancel</Button>}<Button className="min-w-0 whitespace-normal" keepEnabled={allowWhileBusy} onClick={() => { setChecking(true); onConfirmed(false); }}>I’ve saved my recovery phrase</Button></div> : <>
      <p role="status" className="text-sm font-semibold">{complete ? 'Backup confirmed. You’re ready to save your wallet.' : `${Object.keys(answers).length} of 3 confirmed · Choose word ${current.index + 1}`}</p>
      {!complete && <div ref={choices} role="group" aria-label={`Choices for word ${current.index + 1}`} className="grid grid-cols-2 gap-2">
        {current.choices.map(word => <Button keepEnabled={allowWhileBusy} key={`${current.index}:${word}`} variant="subtle" className="min-h-12 font-sans" onClick={() => choose(word)}>{word}</Button>)}
      </div>}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex items-center justify-end gap-3">{onCancel && <Button keepEnabled={allowWhileBusy} variant="subtle" className="!bg-transparent" onClick={onCancel}>Cancel</Button>}<Button keepEnabled={allowWhileBusy} variant="subtle" className="min-w-0 whitespace-normal !bg-transparent" onClick={review}>Review my recovery phrase</Button></div>
    </>}
  </section>;
}
