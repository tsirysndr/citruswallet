import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useNavigate } from "@tanstack/react-router";
import { rpc } from "../../api";
import { useSession } from "../../queries";
import { reviewIdAtom } from "../../atoms";
import { useRun } from "../../hooks";
export function Notifications() {
  const { data: session } = useSession(),
    queries = useQueryClient(),
    review = useSetAtom(reviewIdAtom),
    navigate = useNavigate(),
    run = useRun();
  const dialog = useRef<HTMLDialogElement>(null),
    [message, setMessage] = useState("");
  const { data, error, refetch } = useQuery({
    queryKey: ["notifications", session?.did],
    enabled: !!session?.did,
    queryFn: () => rpc.listNotifications(),
  });
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
  if (!session?.did) return null;
  return (
    <>
      <button
        type="button"
        className="activity-search-trigger relative"
        aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}
        title="Notifications"
        onClick={() => {
          setMessage("");
          dialog.current?.showModal();
        }}
      >
        <Bell size={21} />
        {!!data?.unread && (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-blue-600" />
        )}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
      <dialog
        ref={dialog}
        className="notification-dialog"
        aria-label="Payment notifications"
      >
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => dialog.current?.close()}
            className="p-2"
          >
            <X size={20} />
          </button>
        </header>
        {error ? (
          <button type="button" onClick={() => void refetch()}>
            Could not load notifications. Retry
          </button>
        ) : data?.notifications.length ? (
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
                    dialog.current?.close();
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
      </dialog>
    </>
  );
}
