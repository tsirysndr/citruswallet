import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useProfile, useSession } from '../../queries';
import { Avatar } from '../Avatar';
import { IdentityPanel } from '../IdentityPanel';
export function IdentityPopover({ children, className, label = 'Account information', title, above = false }: { children?: ReactNode; className?: string; label?: string; title?: string; above?: boolean }) {
  const { data: session } = useSession();
  const { data: profile } = useProfile(session?.did);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    closeButton.current?.focus();
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    const resize = () => close();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', resize); };
  }, [position]);
  if (!session?.did) return null;
  const actor = profile ?? { did: session.did, handle: '', displayName: null, avatar: null };
  return <>
    <button ref={trigger} type="button" aria-label={label} title={title} aria-haspopup="dialog" aria-expanded={!!position} aria-controls={id} className={className ?? 'shrink-0 rounded-full'} onClick={() => {
      if (position) { close(); return; }
      const rect = trigger.current!.getBoundingClientRect();
      setPosition({ left: Math.max(12, Math.min(rect.right - 360, window.innerWidth - 372)), ...(above ? { bottom: Math.max(12, window.innerHeight - rect.top + 8) } : { top: Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 420)) }) });
    }}>{children ?? <Avatar actor={actor} size="size-12" />}</button>
    {position && createPortal(<div ref={panel} id={id} role="dialog" aria-label="Account information" className="fixed z-[70] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-edge bg-white shadow-lg" style={{ ...position, maxHeight: Math.max(120, window.innerHeight - (position.top ?? position.bottom ?? 0) - 12) }}>
      <div className="flex justify-end px-3 pt-3"><button ref={closeButton} type="button" aria-label="Close account information" onClick={close} className="flex size-9 items-center justify-center rounded-full"><X size={20} /></button></div>
      <IdentityPanel />
    </div>, document.body)}
  </>;
}
