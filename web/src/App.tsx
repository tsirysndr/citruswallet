import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { send } from "./api";
import { inviteTokenAtom, reviewIdAtom, statusAtom } from "./atoms";
import { BottomNav, HeaderNav } from "./components/Nav";
import { CitrusMark } from "./components/CitrusMark";
import { ThemeToggle } from "./components/ThemeToggle";
import { forgetBroadcast, pendingBroadcast } from "./broadcast";
import { useRefresh, useRun, useStatus } from "./hooks";
import { useSession } from "./queries";
import { useSessionGuard } from "./session";
import type { Payment } from "./types";

/* A reload must never turn one approved transfer into two: a remembered
   broadcast is reported to the server before anything else can be sent. */
function useRecovery() {
  const { data: session } = useSession();
  const queries = useQueryClient();
  const setReviewId = useSetAtom(reviewIdAtom);
  const navigate = useNavigate();
  const run = useRun();
  const status = useStatus();
  const recovered = useRef<string | null>(null);

  useEffect(() => {
    const did = session?.did;
    if (!did || recovered.current === did) return;
    recovered.current = did;
    const pending = pendingBroadcast(did);
    if (!pending) return;
    setReviewId(pending.id);
    navigate({ to: "/payments" });
    run(async () => {
      if (!pending.txHash) {
        status(
          "A previous wallet prompt may have broadcast a transaction. Check MetaMask and attach its original transaction hash before retrying.",
          true,
        );
        return;
      }
      const result = await send<{ payment: Payment }>(
        `/api/payments/${pending.id}/submit`,
        { attemptId: pending.attemptId, txHash: pending.txHash },
      );
      forgetBroadcast(did);
      queries.setQueryData(["payment", pending.id], result.payment);
      status(
        "Recovered the broadcast transaction. Refresh its status to check confirmations.",
      );
    });
  }, [session?.did, navigate, queries, run, setReviewId, status]);
}

export function App() {
  const { data: session, error } = useSession();
  const { message, error: failed } = useAtomValue(statusAtom);
  const review = useAtomValue(reviewIdAtom);
  const invite = useAtomValue(inviteTokenAtom);
  const refresh = useRefresh();
  useRecovery();
  useSessionGuard();

  const marks = { "/payments": Boolean(review), "/wallet": Boolean(invite) };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link
          to="/"
          className="brand-logo"
        >
          <span className="logo-mark"><CitrusMark /></span><span>Citrus<span className="logo-wallet"> Wallet</span></span>
        </Link>
        <HeaderNav marks={marks} />
        <div className="flex items-center gap-2.5">
          <span className="hidden rounded-full border border-edge px-2.5 py-1.5 text-[11px] tracking-[0.04em] text-ink-muted lg:inline">
            {session?.network.name ?? "AT Protocol × Ethereum"}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="app-main">
        <Outlet />
        {error && (
          <p className="mt-5 text-[13px] text-bad">
            Could not reach the server.{" "}
            <button
              type="button"
              onClick={() => refresh()}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-info underline underline-offset-2"
            >
              Try again
            </button>
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          className={`mt-5 min-h-[22px] text-[13px] leading-[1.6] ${failed ? "text-bad" : "text-info"}`}
        >
          {message}
        </p>
      </main>

      <footer className="app-footer">
        <span>Identity on AT Protocol. Assets on Ethereum.</span>
        <span>Made for your corner of the atmosphere.</span>
      </footer>

      <BottomNav marks={marks} />
    </div>
  );
}
