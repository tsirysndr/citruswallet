import { BalanceAccess } from "../components/BalanceAccess";
import { AssetBalances } from "../components/AssetBalances";
import { ContentSkeleton } from "../components/ContentSkeleton";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Eye, EyeOff, Plus, AtSign } from "lucide-react";
import { useState } from "react";
import { IdentityPanel } from "../components/IdentityPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { IdentityPopover } from "../components/IdentityPopover";
import { usePortfolio } from "../portfolio";
import { accountBalance, accountBalanceDetails } from "../balances";
import { useBalances, useProfile, useSession } from "../queries";

export function Account() {
  const { data: session } = useSession();
  const { data: profile } = useProfile(session?.did);
  const { data: balances, isFetching: balanceLoading, refetch: refreshBalance } = useBalances(session);
  const [hidden, setHidden] = useState(false);
  const total = session?.did ? accountBalance(session, balances) : null;
  const portfolio = usePortfolio(session, session ? accountBalanceDetails(session, balances)?.wei ?? null : null, balances?.address);
  const [amount, detail] = total ? total.split(" across ") : [null, null];
  const name = profile?.displayName?.split(" ")[0] || profile?.handle || "there";

  return <div className="home-grid">
    <section className="dashboard">
      <div className="dashboard-greeting"><div><p className="eyebrow">YOUR EVERYDAY WALLET</p><h2>Hello, {name}<span className="greeting-dot">.</span></h2></div>
        {session?.did ? <IdentityPopover /> : <span className="greeting-icon" aria-hidden="true"><AtSign size={24} /></span>}
      </div>
      <div className="balance-stack"><div className="balance-card">
        <div className="balance-label">Total balance <button type="button" onClick={() => setHidden(!hidden)} aria-label={hidden ? "Show balance" : "Hide balance"}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        {(portfolio.loading || balanceLoading && !balances) && !hidden ? <ContentSkeleton variant="line" label="Loading balance" inverse /> : <p className="balance-amount">{hidden ? "••••••" : portfolio.supported ? portfolio.formatted ?? "USD unavailable" : amount ?? (session?.did ? "Balance unavailable" : "—")}</p>}
        {!hidden && <p className="font-mono text-sm font-semibold">{portfolio.supported ? amount : "USD pricing unavailable for this network"}</p>}
        {!hidden && portfolio.supported && portfolio.formatted && <p className="balance-note">{portfolio.partial ? session?.network.chainId === 6343 ? "Partial testnet estimate · some assets have no price" : "Partial estimate · some assets could not be valued" : session?.network.chainId === 6343 ? "Testnet estimate · not redeemable USD" : "Estimated USD value · ETH + tokens"}</p>}
        <div className="balance-bottom"><span className="network-pill"><i />{session?.network.name ?? "Ethereum"}</span></div>
        <p className="balance-note">{session?.did ? detail ? `Across ${detail}` : balanceLoading ? "Loading your balance…" : "Your balance could not be loaded." : "Sign in to see your balance"}</p>
        {session?.did && <BalanceAccess session={session} balances={balances} available={total !== null} loading={balanceLoading} refresh={refreshBalance} />}
      </div></div>
      <div className="quick-actions">
        <Link to="/wallet" search={{ setup: true }} className="action-tile action-link"><Plus /><span>Link wallet</span></Link>
        <Link to="/payments" className="action-tile action-send"><ArrowUpRight /><span>Send</span></Link>
      </div>
      {session?.did && <AssetBalances session={session} hidden={hidden} />}
      {!session?.did && <IdentityPanel className="identity-card" />}
      {session?.did ? <HistoryPanel className="home-history" /> : <div className="welcome-note"><span className="welcome-symbol">@</span><div><h3>A familiar way to pay.</h3><p>Your handle is all you need to get started.</p></div><ArrowUpRight size={20} /></div>}
    </section>
  </div>;
}
