import { Settings as SettingsIcon } from "lucide-react";
import { WalletSetup, configuredAddress } from "./components/WalletSetup";
import { localWalletState, subscribeWallet } from "./local-wallet";
import { WalletUnlock } from "./components/WalletUnlock";
import { WalletApproval } from "./components/WalletApproval";
import { ContentSkeleton } from "./components/ContentSkeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { rpc } from "./api";
import { busyAtom, inviteTokenAtom, reviewIdAtom, statusAtom } from "./atoms";
import { BottomNav, SidebarNav } from "./components/Nav";
import { CitrusMark } from "./components/CitrusMark";
import { Notifications } from "./components/Notifications";
import { ActivitySearch } from "./components/ActivitySearch";
import { InstallApp } from "./components/InstallApp";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MetaMaskConnection } from "./components/MetaMaskConnection";
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
  const walletQueries = useQueryClient();
  useEffect(() => {
    const changed = () => { void walletQueries.invalidateQueries({ queryKey: ["balances"] }); };
    window.addEventListener("citrus:wallet-connected", changed);
    return () => window.removeEventListener("citrus:wallet-connected", changed);
  }, [walletQueries]);
  const { data: session, error, isPending } = useSession();
  const { message, error: failed } = useAtomValue(statusAtom);
  const busy = useAtomValue(busyAtom);
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

  const vaultState = useSyncExternalStore(subscribeWallet, localWalletState);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const checkedAccount = useRef<string | null | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!session || (needsSetup !== null && checkedAccount.current === session.did)) return;
    checkedAccount.current = session.did;
    const address = configuredAddress();
    const configured = vaultState !== 'absent' || Boolean(address) || session.links.length > 0;
    const linkedDefault = session.links.some(link => link.chain_id === session.network.chainId && link.is_default && link.public && (!address || link.address.toLowerCase() === address.toLowerCase()));
    setNeedsSetup(!configured || Boolean(session.did && !linkedDefault));
  }, [session, needsSetup, vaultState]);
  if (needsSetup === null && !error && !['/privacy', '/terms'].includes(location.pathname)) return <div className="min-h-dvh bg-canvas p-8"><ContentSkeleton variant="card" label="Opening Citrus" /></div>;
  if (needsSetup && session && !['/privacy', '/terms'].includes(location.pathname)) return <div className="min-h-dvh bg-canvas px-5 py-8 font-sans md:py-12">
    <div className="mx-auto mb-10 flex max-w-[560px] items-center gap-2 text-lg font-semibold"><CitrusMark className="size-9" />Citrus Wallet</div>
    <MetaMaskConnection /><WalletApproval /><WalletUnlock />
    <WalletSetup key={session.did || 'signed-out'} onFinished={() => { setNeedsSetup(false); void navigate({ to: invite ? '/wallet' : '/' }); }} />
    <p role="status" className={`mx-auto mt-5 max-w-[560px] text-sm ${failed ? 'text-bad' : 'text-ink-muted'}`}>{message}</p>
    {busy && <div className="mx-auto max-w-[560px]"><ContentSkeleton variant="line" label="Connecting wallet" /></div>}
    <div className="mt-10 flex justify-center gap-5 text-xs text-ink-muted"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
  </div>;

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
          {session?.did && <><Notifications /><Link to="/settings" aria-label="Settings" title="Settings" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sunken"><SettingsIcon size={21} strokeWidth={1.75} /></Link><ActivitySearch /></>}

        </div>
      </header>

      <main className="app-main">
        <MetaMaskConnection />
        <WalletApproval />
        <WalletUnlock />
        {isPending ? <div className="page-content"><ContentSkeleton variant="card" label="Opening Citrus" /></div> : <Outlet />}
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
        {busy && <ContentSkeleton variant="line" label="Working" />}
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
