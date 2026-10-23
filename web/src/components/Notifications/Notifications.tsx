import { ContentSkeleton } from "../ContentSkeleton";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { BellIcon } from "../BellIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useNavigate } from "@tanstack/react-router";
import { rpc } from "../../api";
import { useSession } from "../../queries";
import { reviewIdAtom } from "../../atoms";
import { useRun } from "../../hooks";
import { WebPushSettings } from "./WebPushSettings";
export function Notifications() {
  const { data: session } = useSession(),
    queries = useQueryClient(),
    review = useSetAtom(reviewIdAtom),
    navigate = useNavigate(),
    run = useRun();
  const container = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false),
    [marking, setMarking] = useState(false),
    [message, setMessage] = useState("");
  const { data, error, refetch, isPending } = useQuery({
    queryKey: ["notifications", session?.did],
    enabled: !!session?.did,
    queryFn: () => rpc.listNotifications(),
  });
  useEffect(() => {
    if (!session?.did) return;
    const open = (paymentId: unknown, notificationId?: unknown) => {
      if (typeof paymentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(paymentId)) return;
      review(paymentId);
      void navigate({ to: '/payments' });
      if (typeof notificationId === 'string' && /^\d+$/.test(notificationId))
        void rpc.markNotificationRead({ id: notificationId }).then(() => queries.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    };
    const params = new URLSearchParams(window.location.search);
    try {
      const target = JSON.parse(sessionStorage.getItem('citrus:notification-target') || 'null');
      if (target && !params.has('notificationPayment')) open(target.paymentId, target.notificationId);
      sessionStorage.removeItem('citrus:notification-target');
    } catch {}
    if (params.has('notificationPayment')) {
      open(params.get('notificationPayment'), params.get('notificationId'));
      params.delete('notificationPayment'); params.delete('notificationId');
      history.replaceState(history.state, '', window.location.pathname + (params.size ? '?' + params : '') + window.location.hash);
    }
    const receive = (event: MessageEvent) => {
      if (event.data?.type === 'citrus-open-payment') open(event.data.paymentId, event.data.notificationId);
    };
    navigator.serviceWorker?.addEventListener('message', receive);
    return () => navigator.serviceWorker?.removeEventListener('message', receive);
  }, [session?.did, review, navigate, queries]);
  useEffect(() => {
    if (!session?.did || typeof EventSource === "undefined") return;
    const key = `citrus:notifications:${session.did}:${session.network.chainId}`;
    let cursor = "0";
    try {
      cursor = sessionStorage.getItem(key) || "0";
    } catch {}
    const source = new EventSource(
      `/xrpc/app.citruswallet.subscribeNotifications?cursor=${encodeURIComponent(cursor)}`,
    );
    source.addEventListener("payment-received", (event) => {
      try {
        const notification = JSON.parse((event as MessageEvent).data);
        if (!/^\d+$/.test(notification.id)) return;
        try {
          sessionStorage.setItem(key, notification.id);
        } catch {}
        setMessage("Payment received");
        void queries.invalidateQueries({ queryKey: ["notifications"] });
        void queries.invalidateQueries({ queryKey: ["payments"] });
        void queries.invalidateQueries({ queryKey: ["balances"] });
      } catch {}
    });
    source.addEventListener("session-expired", () => {
      source.close();
      void queries.invalidateQueries({ queryKey: ["session"] });
    });
    return () => source.close();
  }, [session?.did, session?.network.chainId, queries]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!session?.did) return null;
  return (
    <div ref={container} className="relative inline-flex">
      <button
        type="button"
        className="activity-search-trigger relative"
        aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}
        ref={trigger}
        aria-expanded={open}
        aria-controls="notification-popover"
        title="Notifications"
        onClick={() => {
          setMessage("");
          setOpen(value => !value);
        }}
      >
        <BellIcon size={21} />
        {!!data?.unread && (
          <span aria-hidden="true" className="notification-count">{data.unread > 99 ? '99+' : data.unread}</span>
        )}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
      {open && <section
        id="notification-popover"
        className="notification-popover"
        aria-label="Payment notifications"
      >
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="p-2"
          >
            <X size={20} />
          </button>
        </header>
        <button type="button" className="mt-2 text-sm font-semibold text-info disabled:opacity-40" disabled={!data?.unread || marking} onClick={() => {
          run(async () => {
            setMarking(true);
            try {
              await rpc.markAllNotificationsRead({});
              await queries.invalidateQueries({ queryKey: ['notifications'] });
            } finally { setMarking(false); }
          });
        }}>{marking ? 'Marking…' : 'Mark all as read'}</button>
        <WebPushSettings did={session.did} />
        {error ? (
          <button type="button" onClick={() => void refetch()}>
            Could not load notifications. Retry
          </button>
        ) : isPending ? <ContentSkeleton label="Loading notifications" /> : data?.notifications.length ? (
          <div className="mt-4 grid gap-2">
            {data.notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className="notification-item"
                onClick={() =>
                  run(async () => {
                    await rpc.markNotificationRead({ id: item.id });
                    await queries.invalidateQueries({
                      queryKey: ["notifications"],
                    });
                    review(item.paymentId);
                    setOpen(false);
                    void navigate({ to: "/payments" });
                  })
                }
              >
                <span className="font-semibold">
                  {item.read ? "" : "● "}Payment received
                </span>
                <span className="text-xs text-ink-muted">
                  {new Date(Number(item.createdAt)).toLocaleString()}
                </span>
                <span className="text-sm">View payment →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-sm text-ink-muted">
            Your confirmed incoming payments will appear here.
          </p>
        )}
      </section>}
    </div>
  );
}
