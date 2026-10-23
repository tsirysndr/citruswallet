import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { rpc } from "./api";
import { inviteTokenAtom, reviewIdAtom, statusAtom } from "./atoms";
import { BottomNav, SidebarNav } from "./components/Nav";
import { CitrusMark } from "./components/CitrusMark";
import { Notifications } from "./components/Notifications";
import { ActivitySearch } from "./components/ActivitySearch";
import { InstallApp } from "./components/InstallApp";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MetaMaskConnection } from "./components/MetaMaskConnection";
import { InstallMetaMask } from "./components/InstallMetaMask";
import { forgetBroadcast, pendingBroadcast } from "./broadcast";
import { useRefresh, useRun, useStatus } from "./hooks";
import { useSession } from "./queries";
import { useSessionGuard } from "./session";

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
      const result = await rpc.submitPayment(
        { id: pending.id, attemptId: pending.attemptId, txHash: pending.txHash },
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

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("citrus:sidebar-collapsed") === "true"; }
    catch { return false; }
  });
  const toggleSidebar = () => setCollapsed(current => {
    const next = !current;
    try { localStorage.setItem("citrus:sidebar-collapsed", String(next)); } catch { /* Storage may be unavailable. */ }
    return next;
  });

  const marks = { "/payments": Boolean(review), "/wallet": Boolean(invite) };

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <SidebarNav marks={marks} collapsed={collapsed} onToggle={toggleSidebar} network={session?.network.name ?? "AT Protocol × Ethereum"} />
      <div className="app-workspace">
      <header className="app-header">
        <Link
          to="/"
          className="brand-logo mobile-brand"
        >
          <span className="logo-mark"><CitrusMark /></span><span>Citrus<span className="logo-wallet hidden min-[400px]:inline"> Wallet</span></span>
        </Link>
        <div className="flex items-center gap-2.5">
          {session?.did && <><Notifications /><ActivitySearch /></>}
          <InstallMetaMask />
        </div>
      </header>

      <main className="app-main">
        <MetaMaskConnection />
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
        <nav className="legal-footer-links" aria-label="Legal and contact">
          <InstallApp />
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms and Conditions</Link>
          <a href="mailto:contact@citruswallet.app">Contact</a>
        </nav>
      </footer>

      </div>
      <BottomNav marks={marks} />
      <KeyboardShortcuts />
    </div>
  );
}
