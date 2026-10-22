import { useState } from "react";
import type { PaymentMedia as Media } from "../lexicon/types/app/citruswallet/defs";
import { safeMediaUrl } from "../klipy";

export function PaymentMedia({ media, compact = false }: { media?: Media | null; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!media || !safeMediaUrl(media.url) || !safeMediaUrl(media.preview)) return null;
  return <figure className={`payment-media ${compact ? "payment-media-compact" : ""}`}>
    {failed ? <p className="text-xs text-ink-muted">This KLIPY attachment is no longer available.</p> : media.kind === "clips"
      ? <video key={media.url} src={media.url} poster={media.preview} controls playsInline preload="none" aria-label={media.title || "KLIPY clip"} onError={() => setFailed(true)} />
      : <img key={media.url} src={compact ? media.preview : media.url} alt={media.title || "KLIPY attachment"} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    <figcaption>Powered by <a href="https://klipy.com" target="_blank" rel="noopener noreferrer">KLIPY</a></figcaption>
  </figure>;
}
