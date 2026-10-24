import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { PeachletMark } from '../PeachletMark';

export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return <div className="peachlet-landing">
    <header className="landing-header">
      <span className="flex items-center gap-2 text-xl font-semibold"><PeachletMark className="size-10" />Peachlet</span>
      <button type="button" onClick={onGetStarted} className="landing-start">Get started <ArrowUpRight size={18} aria-hidden="true" /></button>
    </header>
    <main className="landing-hero">
      <div className="landing-copy">
      <p className="mb-5 text-sm font-semibold">A little more human.</p>
      <h1>Send ETH.<br />To a handle.</h1>
      <p className="landing-description">Send crypto to a short, readable <a href="https://atproto.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">AT Protocol</a> handle instead of a long wallet address. Your wallet. Your keys. Your people.</p>
      <div className="landing-example" aria-label="Use a handle instead of a long wallet address"><span className="line-through opacity-50">0x7F4a…9c2D</span><span aria-hidden="true">→</span><span>@alice.bsky.social</span></div>
      </div>
      <div className="landing-phone"><img src="/images/peachlet-android.png" alt="Peachlet wallet showing balances and assets on MegaETH, displayed in an Android phone" fetchPriority="high" /></div>
    </main>
    <footer className="landing-footer"><span>A wallet that knows your name.</span><nav aria-label="Legal"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav></footer>
  </div>;
}
