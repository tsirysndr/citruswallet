import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Plus, ShieldCheck, AtSign } from "lucide-react";
import { useState } from "react";
import { IdentityPanel } from "../components/IdentityPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { CitrusMark } from "../components/CitrusMark";
import { Avatar } from "../components/Avatar";
import { accountBalance } from "../balances";
import { useBalances, useProfile, useSession } from "../queries";

function ConnectionIllustration() {
  return <div className="connection-art" aria-hidden="true">
    <svg viewBox="0 0 360 280" fill="none">
      <ellipse cx="180" cy="140" rx="157" ry="89" stroke="currentColor" strokeOpacity=".2" transform="rotate(-28 180 140)" />
      <ellipse cx="180" cy="140" rx="118" ry="118" stroke="currentColor" strokeOpacity=".12" />
      <path d="M67 188C133 205 238 82 293 91" stroke="currentColor" strokeOpacity=".45" strokeDasharray="3 7" />
      <circle cx="180" cy="140" r="77" fill="#e3d1fc" />
      <circle cx="180" cy="140" r="63" stroke="#171612" strokeWidth="2" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} d="M180 88L180 122" stroke="#171612" strokeWidth="13" strokeLinecap="round" transform={`rotate(${i * 45} 180 140)`} />)}
      <circle cx="180" cy="140" r="9" fill="#171612" />
      <rect x="24" y="171" width="68" height="52" rx="18" fill="#c5f277" />
      <text x="58" y="205" textAnchor="middle" fill="#171612" fontSize="30">@</text>
      <rect x="267" y="55" width="68" height="52" rx="18" fill="#3769ff" />
      <path d="M289 81H312M304 73L312 81L304 89" stroke="#c5f277" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="109" cy="38" r="5" fill="#c5f277" /><circle cx="282" cy="227" r="7" fill="#ffd7ab" />
    </svg>
    <span className="connection-caption">A name. A connection. A little Citrus.</span>
  </div>;
}

export function Account() {
  const { data: session } = useSession();
  const { data: profile } = useProfile(session?.did);
  const { data: balances } = useBalances(session);
  const [hidden, setHidden] = useState(false);
  const total = session?.did ? accountBalance(session, balances) : null;
  const [amount, detail] = total ? total.split(" across ") : [null, null];
  const name = profile?.displayName?.split(" ")[0] || profile?.handle || "there";

  return <div className="home-grid">
    <section className="brand-card">
      <div className="brand-eyebrow"><CitrusMark /> THE SOCIAL SIDE OF YOUR WALLET.</div>
      <ConnectionIllustration />
      <h1>Good things<br />start with<br /><span>a connection.</span></h1>
      <p>From your wallet to their world. Send ETH to the people you know, with a handle you recognize.</p>
      <Link to="/payments" className="brand-cta">Make a connection <ArrowUpRight size={22} /></Link>
      <div className="brand-footnote"><ShieldCheck size={15} /> Your keys stay in MetaMask.</div>
    </section>

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
