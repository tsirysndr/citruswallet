import { ContentSkeleton } from "../ContentSkeleton";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Search, X, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PaymentMedia as Media } from "../../lexicon/types/app/citruswallet/defs";
import { fetchMedia, klipyEnabled, mediaKinds, type MediaKind } from "../../klipy";
import { PaymentMedia } from "../PaymentMedia";

export function KlipyPicker({ value, onChange, children }: { children?: ReactNode; value: Media | null; onChange: (media: Media | null, query?: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MediaKind>("gifs");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  const results = useQuery({ queryKey: ["klipy", kind, query, page], queryFn: ({ signal }) => fetchMedia(kind, query, page, signal), enabled: open && klipyEnabled, retry: false, staleTime: 0, gcTime: 0 });
  const close = () => { dialog.current?.close(); setOpen(false); };
  const waiting = search.trim() !== query;
  return <div className="klipy-attachment">
    <div className={children ? "klipy-editor" : undefined}>
      {children}
      <button type="button" className="klipy-trigger" aria-label={value ? "Change media" : "Add GIF, sticker, meme or clip"} title={value ? "Change media" : "Add GIF"} onClick={() => { setOpen(true); dialog.current?.showModal(); }}><ImagePlus size={20} aria-hidden="true" /></button>
    </div>
    {value && <div className="klipy-selected"><PaymentMedia key={value.url} media={value} /><button className="klipy-remove" type="button" aria-label="Remove attachment" onClick={() => onChange(null)}><X size={17} /></button></div>}
    <dialog ref={dialog} className="klipy-dialog" aria-labelledby="klipy-title" onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } }}>
      <header><div><p className="eyebrow">A LITTLE MORE EXPRESSION</p><h2 id="klipy-title">Say it with KLIPY.</h2></div><button type="button" className="klipy-close" aria-label="Close media picker" onClick={close}><X size={21} /></button></header>
      <div className="klipy-tabs" aria-label="Media type">{mediaKinds.map(tab => <button type="button" aria-pressed={kind === tab.value} key={tab.value} onClick={() => { setKind(tab.value); setPage(1); }}>{tab.label}</button>)}</div>
      <label className="klipy-search"><Search size={18} /><span className="sr-only">Search KLIPY</span><input type="search" placeholder="Search KLIPY" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></label>
      <div className="klipy-results" aria-live="polite" aria-busy={results.isFetching || waiting}>
        {!klipyEnabled ? <p>Media search is currently unavailable. You can still add a description.</p> : results.isError ? <div className="klipy-empty"><p>{results.error.message}</p><button type="button" onClick={() => results.refetch()}>Try again</button></div> : results.isPending || waiting ? <ContentSkeleton variant="media" label="Loading media" /> : !results.data?.items.length ? <p className="klipy-empty">No results. Try another search.</p> : <div className="klipy-grid">{results.data.items.map((item, i) => <button type="button" key={`${kind}-${page}-${i}`} disabled={!item.media} title={item.title} aria-label={`Attach ${item.title}`} onClick={() => { if (item.media) { onChange(item.media, query); close(); } }}>
          {item.media ? <><img src={item.media.preview} alt={item.title} loading="lazy" referrerPolicy="no-referrer" />{kind === "clips" && <span className="klipy-play"><Play size={15} /> Clip</span>}</> : <span>Media unavailable</span>}
        </button>)}</div>}
      </div>
      <footer><a href="https://klipy.com" target="_blank" rel="noopener noreferrer">Powered by <strong>KLIPY</strong></a><div><button type="button" disabled={page === 1 || results.isFetching || waiting} onClick={() => setPage(page - 1)}>Previous</button><span>{page}</span><button type="button" disabled={!results.data?.hasNext || results.isFetching || waiting} onClick={() => setPage(page + 1)}>Next</button></div></footer>
      <p className="klipy-disclosure">Searches and media load directly from KLIPY.</p>
    </dialog>
  </div>;
}
