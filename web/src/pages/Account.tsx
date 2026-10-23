import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Plus, AtSign } from "lucide-react";
import { useState } from "react";
import { IdentityPanel } from "../components/IdentityPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { CitrusMark } from "../components/CitrusMark";
import { Avatar } from "../components/Avatar";
import { accountBalance } from "../balances";
import { useBalances, useProfile, useSession } from "../queries";

export function Account() {
  const { data: session } = useSession();
  const { data: profile } = useProfile(session?.did);
  const { data: balances } = useBalances(session);
  const [hidden, setHidden] = useState(false);
  const total = session?.did ? accountBalance(session, balances) : null;
  const [amount, detail] = total ? total.split(" across ") : [null, null];
  const name = profile?.displayName?.split(" ")[0] || profile?.handle || "there";

  return <div className="home-grid">
    <section className="dashboard">
      <div className="dashboard-greeting"><div><p className="eyebrow">YOUR EVERYDAY WALLET</p><h2>Hello, {name}<span className="greeting-dot">.</span></h2></div>
        {profile ? <Avatar actor={profile} size="size-12" /> : <span className="greeting-icon" aria-hidden="true"><AtSign size={24} /></span>}
      </div>
      <div className="balance-stack"><div className="balance-card">
        <div className="balance-label">Your balance <button type="button" onClick={() => setHidden(!hidden)} aria-label={hidden ? "Show balance" : "Hide balance"}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        <p className="balance-amount">{hidden ? "••••••" : amount ?? "—"}</p>
        <div className="balance-bottom"><span className="network-pill"><i />{session?.network.name ?? "Ethereum"}</span><CitrusMark className="balance-seal" /></div>
        <p className="balance-note">{session?.did ? detail ? `Across ${detail}` : "Link a wallet to see your balance" : "Sign in to see your balance"}</p>
      </div></div>
      <div className="quick-actions">
        <Link to="/wallet" className="action-tile action-link"><Plus /><span>Link wallet</span></Link>
        <Link to="/payments" className="action-tile action-send"><ArrowUpRight /><span>Send ETH</span></Link>
        <Link to="/wallet" className="action-tile action-receive"><ArrowDownLeft /><span>Receive</span></Link>
      </div>
      <IdentityPanel className="identity-card" />
      {session?.did ? <HistoryPanel className="home-history" /> : <div className="welcome-note"><span className="welcome-symbol">@</span><div><h3>A familiar way to pay.</h3><p>Your handle is all you need to get started.</p></div><ArrowUpRight size={20} /></div>}
    </section>
  </div>;
}
