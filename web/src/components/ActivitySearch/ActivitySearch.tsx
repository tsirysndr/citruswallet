import { ContentSkeleton } from "../ContentSkeleton";
import { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Search, X } from "lucide-react";
import { reviewIdAtom } from "../../atoms";
import { label } from "../../format";
import { usePayments, useSession } from "../../queries";
import { Avatar } from "../Avatar";

export function ActivitySearch() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const setReview = useSetAtom(reviewIdAtom);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(0);
  const { data, isFetching, error, refetch } = usePayments(open ? session : undefined, {
    q: query || undefined, page, pageSize: 8, sort: "newest",
  });
  const waiting = text.trim() !== query || isFetching;
  const payments = waiting || error ? [] : data?.payments ?? [];
  const close = () => dialog.current?.close();
  const show = () => {
    if (document.querySelector("dialog[open]")) return;
    setText(""); setQuery(""); setPage(1); setSelected(0);
    dialog.current?.showModal(); setOpen(true); input.current?.focus();
  };
  useEffect(() => {
    window.addEventListener("citrus:activity-search", show);
    return () => window.removeEventListener("citrus:activity-search", show);
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { setQuery(text.trim()); setPage(1); setSelected(0); }, 150);
    return () => clearTimeout(timeout);
  }, [text]);
  useEffect(() => { close(); setText(""); setQuery(""); }, [session?.did]);
  useEffect(() => {
    if (open) document.getElementById(`quick-activity-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected, open]);
  const choose = (id: string) => {
    setReview(id); close(); void navigate({ to: "/payments" });
  };
  return <>
    <button type="button" className="activity-search-trigger" aria-label="Search activity" title="Search activity" aria-haspopup="dialog" aria-expanded={open} aria-controls="activity-command" onClick={show}><Search size={21} aria-hidden="true" /></button>
    <dialog ref={dialog} id="activity-command" className="activity-command" aria-label="Search activity" onClose={() => setOpen(false)} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
    }}>
      <div className="command-search-field">
        <Search size={23} aria-hidden="true" />
        <input ref={input} type="search" aria-label="Search your activity" placeholder="Search your activity…" maxLength={128} value={text} autoComplete="off" spellCheck={false}
          role="combobox" aria-autocomplete="list" aria-expanded={true} aria-controls="quick-activity-results" aria-activedescendant={payments[selected] ? `quick-activity-${selected}` : undefined}
          onChange={event => { setText(event.target.value); setSelected(0); }} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setSelected(current => Math.max(0, Math.min(payments.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
            }
            if (event.key === "Enter" && payments[selected]) { event.preventDefault(); choose(payments[selected]!.id); }
          }} />
        <button type="button" aria-label="Close activity search" onClick={close}><X size={19} /></button>
      </div>
      <div className="command-section-label" role="status" aria-live="polite">{!session?.did ? "Your activity" : waiting ? "Searching…" : error ? "Search unavailable" : query ? `${data?.total ?? 0} matching payments` : "Recent activity"}</div>
      <div className="command-results" id="quick-activity-results" role="listbox" aria-label="Payments" aria-busy={waiting}>
        {session?.did && payments.map((payment, index) => {
          const outgoing = payment.senderDid === session.did;
          const actor = (outgoing ? payment.recipient : payment.sender) ?? {
            did: outgoing ? payment.recipientDid : payment.senderDid,
            handle: outgoing && !payment.recipientLabel.startsWith("did:") ? payment.recipientLabel : "", displayName: null, avatar: null,
          };
          const name = actor.displayName || (actor.handle ? `@${actor.handle}` : actor.did);
          const Direction = outgoing ? ArrowUpRight : ArrowDownLeft;
          return <button type="button" role="option" aria-selected={selected === index} id={`quick-activity-${index}`} key={payment.id} className="command-result" onFocus={() => setSelected(index)} onPointerMove={() => setSelected(index)} onClick={() => choose(payment.id)}>
            <Avatar actor={actor} size="size-10" />
            <span className="command-person"><span className="command-name"><Direction size={14} aria-hidden="true" />{outgoing ? "To" : "From"} <span className={actor.displayName ? "" : "font-mono"}>{name}</span></span>
              {actor.displayName && actor.handle && <span className="command-handle">@{actor.handle}</span>}
              {payment.description && <span className="command-description">{payment.description}</span>}
              <span className="command-meta">{new Date(payment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · <span className={`rounded-full px-2 py-1 payment-status-${payment.state}`}>{label(payment.state)}</span></span>
            </span>
            <span className="command-amount">{payment.amount} ETH</span>
          </button>;
        })}
      </div>
      {!session?.did ? <p className="command-empty">Sign in to search your payments.</p> : error ? <div className="command-empty">Could not search activity. <button type="button" onClick={() => void refetch()}>Try again</button></div> : !waiting && !payments.length ? <p className="command-empty">{query ? "No payments found. Try another name, handle, or description." : "Your payments will appear here."}</p> : waiting ? <ContentSkeleton label="Finding payments" /> : null}
      <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close</span>
        {session?.did && (data?.total ?? 0) > 8 && <div><button type="button" disabled={page <= 1 || waiting} onClick={() => { setPage(p => p - 1); setSelected(0); }}>Previous</button><span>{page} / {Math.ceil((data?.total ?? 0) / 8)}</span><button type="button" disabled={page * 8 >= (data?.total ?? 0) || waiting} onClick={() => { setPage(p => p + 1); setSelected(0); }}>Next</button></div>}
      </footer>
    </dialog>
  </>;
}
