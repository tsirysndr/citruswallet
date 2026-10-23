import { ContentSkeleton } from "../ContentSkeleton";
import { PaymentMedia } from "../PaymentMedia";
import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Search, RefreshCw, X, Trash2 } from "lucide-react";
import { reviewIdAtom } from "../../atoms";
import { label } from "../../format";
import { useRefresh, useRun, useStatus } from "../../hooks";
import { useInfinitePayments, usePayments, useSession, type PaymentFilters } from "../../queries";
import { rpc } from "../../api";
import { useQueryClient } from "@tanstack/react-query";
import type { Payment } from "../../types";
import { DateRangePicker } from "../DateRangePicker";
import { Avatar } from "../Avatar";
import { Badge, Button, Heading, Hint, Input, Label, Panel, PanelHeading, Select } from "../ui";

const states = ["waiting", "ready", "prepared", "submitted", "confirming", "confirmed", "failed", "cancelled", "expired"] as const;

export function HistoryPanel({ className, advanced = false }: { className?: string; advanced?: boolean }) {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [filters, setFilters] = useState<PaymentFilters>({ page: 1, pageSize: advanced ? 20 : 5 });
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const mobileHistory = advanced && mobile;
  const loadMore = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const changed = () => setMobile(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const invalidDates = Boolean(from && until && from > until);
  const paged = usePayments(session, filters, !mobileHistory);
  const infinite = useInfinitePayments(session, { ...filters, pageSize: 20 }, mobileHistory);
  const { isPending, isFetching, error, refetch } = mobileHistory ? infinite : paged;
  const accumulated = infinite.data?.pages.flatMap(page => page.payments) ?? [];
  const data = mobileHistory ? { total: infinite.data?.pages[0]?.total ?? 0,
    payments: accumulated.filter((payment, index) => accumulated.findIndex(item => item.id === payment.id) === index) } : paged.data;
  const fatalError = error && (!mobileHistory || !data?.payments.length);
  const status = useStatus();
  const [reviewId, setReviewId] = useAtom(reviewIdAtom);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const run = useRun();
  const refresh = useRefresh();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const update = (change: PaymentFilters) => setFilters(current => ({ ...current, ...change, page: 1 }));

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(current => current.q === search.trim() ? current : { ...current, q: search.trim() || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // A date range follows the viewer's local calendar, including DST transitions.
  useEffect(() => {
    if (from && until && from > until) return;
    const end = until ? new Date(`${until}T00:00:00`) : null;
    if (end) end.setDate(end.getDate() + 1);
    setFilters(current => ({ ...current, page: 1,
      after: from ? String(new Date(`${from}T00:00:00`).getTime()) : undefined,
      before: end ? String(end.getTime() - 1) : undefined,
    }));
  }, [from, until]);

  const page = filters.page ?? 1;
  const size = mobileHistory ? 20 : filters.pageSize ?? 20;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / size));
  useEffect(() => {
    if (!mobileHistory && data && page > pages) setFilters(current => ({ ...current, page: pages }));
  }, [data, page, pages, mobileHistory]);

  const searching = search.trim() !== (filters.q ?? "");
  useEffect(() => {
    if (!mobileHistory || !infinite.hasNextPage || isFetching || error || searching || invalidDates || filtersOpen || !loadMore.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void infinite.fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: "0px 0px 280px 0px" });
    observer.observe(loadMore.current);
    return () => observer.disconnect();
  }, [mobileHistory, infinite.hasNextPage, infinite.fetchNextPage, isFetching, error, searching, invalidDates, filtersOpen]);
  if (!session?.did) return null;
  const filterCount = [Boolean(from || until), Boolean(filters.direction && filters.direction !== "all"), Boolean(filters.status && filters.status !== "all"), filters.sort === "oldest", size !== 20].filter(Boolean).length;
  const activeFilters = Boolean(search || filterCount);
  const clear = () => {
    setFrom(""); setUntil("");
    setFilters({ q: search.trim() || undefined, page: 1, pageSize: 20, sort: "newest" });
  };

  return (
    <Panel className={className}>
      <PanelHeading>
        <Heading>{advanced ? "Payment history" : "Recent activity"}</Heading>
        <button type="button" className="activity-refresh ml-auto" aria-label="Refresh activity" title="Refresh activity" disabled={isFetching} onClick={() => void refetch()}><RefreshCw size={18} aria-hidden="true" /></button>
      </PanelHeading>
      {advanced && (
        <div className="mb-5">
          <Label htmlFor="activity-search">Search payments</Label>
          <div className="activity-search-bar">
            <div className="relative min-w-0 flex-1">
              <Search size={17} aria-hidden="true" className="absolute left-3 top-3.5 text-ink-muted" />
              <Input id="activity-search" type="search" value={search} maxLength={128} className="pl-10" placeholder="Search your activity" onChange={e => setSearch(e.target.value)} />
            </div>
            <button type="button" className={`activity-filter-toggle ${filterCount ? "is-active" : ""}`} aria-label={`Filters${filterCount ? `, ${filterCount} active` : ""}`} aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="activity-filter-drawer" onClick={() => { filterDialog.current?.showModal(); setFiltersOpen(true); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 7h3m6 0h9M3 17h9m6 0h3" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></svg>
              {filterCount > 0 && <span aria-hidden="true">{filterCount}</span>}
            </button>
          </div>
          <dialog id="activity-filter-drawer" ref={filterDialog} className="activity-filter-drawer" aria-labelledby="activity-filter-title" onClose={() => setFiltersOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right) filterDialog.current?.close(); } }}>
            <header><h2 id="activity-filter-title">Filter activity</h2><button type="button" className="drawer-close" aria-label="Close filters" onClick={() => filterDialog.current?.close()}><X size={22} /></button></header>
            <div className="activity-filter-fields">
              <div><Label htmlFor="activity-direction">Transaction type</Label><Select id="activity-direction" className="m-0! w-full" value={filters.direction ?? "all"} onChange={e => update({ direction: e.target.value as PaymentFilters["direction"] })}>
                <option value="all">All transactions</option><option value="sent">Sent payments</option><option value="received">Received payments</option>
              </Select></div>
              <div><Label htmlFor="activity-status">Status</Label><Select id="activity-status" className="m-0! w-full" value={filters.status ?? "all"} onChange={e => update({ status: e.target.value as PaymentFilters["status"] })}>
                <option value="all">All statuses</option>{states.map(state => <option key={state} value={state}>{label(state)}</option>)}
              </Select></div>
              <div><Label>Date range</Label><DateRangePicker value={{ from, until }} onChange={range => { setFrom(range.from); setUntil(range.until); }} /></div>
              {invalidDates && <p role="alert" className="text-xs text-bad">The start date must be before the end date.</p>}
              <div><Label htmlFor="activity-sort">Sort</Label><Select id="activity-sort" className="m-0! w-full" value={filters.sort ?? "newest"} onChange={e => update({ sort: e.target.value as PaymentFilters["sort"] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></Select></div>
              {!mobileHistory && <div><Label htmlFor="activity-size">Per page</Label><Select id="activity-size" className="m-0! w-full" value={size} onChange={e => update({ pageSize: Number(e.target.value) })}>{[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}</Select></div>}
            </div>
            <footer><button type="button" className="drawer-reset" disabled={!filterCount} onClick={clear}>Reset filters</button><Button disabled={invalidDates} onClick={() => filterDialog.current?.close()}>Show results</Button></footer>
          </dialog>
        </div>
      )}
      <p role="status" aria-live="polite" className="mb-2 min-h-5 text-xs text-ink-muted">
        {invalidDates ? "Choose a valid date range to update results." : mobileHistory && infinite.isFetchingNextPage ? "Loading more payments…" : isFetching || searching ? "Searching payments…" : fatalError ? "Could not load payment history. Try refreshing." : `${data?.total ?? 0} payment${data?.total === 1 ? "" : "s"}${activeFilters ? " matching your filters" : ""}`}
      </p>
      <div aria-busy={isFetching || searching}>
        {(isPending || (isFetching && !infinite.isFetchingNextPage)) && <ContentSkeleton label="Loading payments" rows={data?.payments.length ? 1 : 3} />}
        {!invalidDates && !fatalError && (data?.payments ?? []).map(payment => {
          const outgoing = payment.senderDid === session.did;
          const actor = (outgoing ? payment.recipient : payment.sender) ?? {
            did: outgoing ? payment.recipientDid : payment.senderDid,
            handle: outgoing && !payment.recipientLabel.startsWith("did:") ? payment.recipientLabel : "",
            displayName: null, avatar: null,
          };
          const name = actor.displayName || (actor.handle ? `@${actor.handle}` : actor.did);
          const DirectionIcon = outgoing ? ArrowUpRight : ArrowDownLeft;
          return (
            <div key={payment.id} className="activity-row flex flex-wrap items-center gap-3 border-t border-edge-soft py-4">
              <Avatar actor={actor} size="size-11" />
              <div className="activity-person min-w-0 flex-1 text-[13px]">
                <p className="m-0! flex items-center gap-1 font-semibold"><DirectionIcon size={14} aria-hidden="true" /><span>{outgoing ? "To" : "From"}</span><span className={`truncate ${actor.displayName ? "" : "font-mono"}`} title={name}>{name}</span></p>
                {actor.displayName && actor.handle && <p className="truncate font-mono text-xs text-ink-muted">@{actor.handle}</p>}
                {payment.description && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-ink-soft [overflow-wrap:anywhere]">{payment.description}</p>}
                <PaymentMedia key={payment.media?.url} media={payment.media} compact />
                <p className="mt-1 text-[12px] text-ink-muted"><time dateTime={payment.createdAt}>{new Date(payment.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></p>
              </div>
              <div className="activity-summary"><span className="whitespace-nowrap font-mono text-[15px] font-bold tabular-nums">{payment.amount} ETH</span><Badge status={payment.state}>{label(payment.state)}</Badge></div>
              {outgoing && payment.state === "cancelled" && <button type="button" className="date-icon-button text-bad" aria-label={`Delete cancelled payment to ${name}`} onClick={() => { setDeleteError(""); setDeleting(payment); deleteDialog.current?.showModal(); }}><Trash2 size={16} /></button>}
              <Button variant="subtle" onClick={() => { setReviewId(payment.id); void navigate({ to: "/payments" }); status("Review the payment details."); }}>Details</Button>
            </div>
          );
        })}
        {!invalidDates && !isPending && !fatalError && !data?.payments.length && <Hint>{activeFilters ? "No payments match these filters." : "No payment intents yet."}</Hint>}
      </div>
      {advanced && !mobileHistory && !invalidDates && !error && (
        <nav aria-label="Payment history pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge-soft pt-4">
          <Hint>{data?.total ? `${(page - 1) * size + 1}–${Math.min(page * size, data.total)} of ${data.total}` : "0 results"} · Page {page} of {pages}</Hint>
          <div className="flex gap-2"><Button variant="subtle" disabled={page <= 1 || isFetching || searching} onClick={() => setFilters(current => ({ ...current, page: page - 1 }))}>Previous</Button><Button variant="subtle" disabled={page >= pages || isFetching || searching} onClick={() => setFilters(current => ({ ...current, page: page + 1 }))}>Next</Button></div>
        </nav>
      )}
      {mobileHistory && !invalidDates && <div className="mt-4 text-center">
        <div ref={loadMore} data-testid="activity-load-more" aria-hidden="true" className="h-px" />
        {infinite.isFetchingNextPage && <ContentSkeleton label="Loading more payments" rows={1} />}
        {infinite.isFetchNextPageError && <Button variant="subtle" onClick={() => void infinite.fetchNextPage()}>Retry loading more</Button>}
        {!infinite.hasNextPage && !isFetching && !error && Boolean(data?.payments.length) && <Hint>You're all caught up.</Hint>}
      </div>}
      {!advanced && <Link to="/activity" className="mt-4 inline-block text-xs font-semibold text-info underline underline-offset-2">View all activity</Link>}
      <dialog ref={deleteDialog} className="date-dialog max-w-md" aria-labelledby="delete-intent-title">
        <div className="date-dialog-inner">
          <h2 id="delete-intent-title" className="text-lg font-semibold">Delete cancelled intent?</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">This permanently removes the cancelled {deleting?.amount} ETH intent from payment history for you and the recipient. It cannot be undone. No funds will move.</p>
          {deleteError && <p role="alert" className="mt-3 text-sm text-bad">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="subtle" onClick={() => deleteDialog.current?.close()}>Keep intent</Button>
            <Button className="bg-bad text-white" onClick={() => run(async () => {
              if (!deleting) return;
              try { await rpc.deletePayment({ id: deleting.id }); }
              catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete the intent. Please try again."); return; }
              queries.removeQueries({ queryKey: ["payment", deleting.id] });
              if (reviewId === deleting.id) setReviewId(null);
              deleteDialog.current?.close(); setDeleting(null);
              await refresh(); status("Cancelled intent deleted.");
            })}>Delete intent</Button>
          </div>
        </div>
      </dialog>
      <Hint className="mt-4">Invitations reserve no funds. “Confirmed” means the matching transaction reached the required on-chain confirmations.</Hint>
    </Panel>
  );
}
