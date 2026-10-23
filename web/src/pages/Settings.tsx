import { useState, useSyncExternalStore } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ChevronRight, Globe2, ShieldCheck, Wallet } from 'lucide-react';
import { NetworkSettings } from '../components/NetworkSettings';
import { LocalWallet } from '../components/LocalWallet';
import { LinkedAddresses } from '../components/LinkedAddresses';
import { PageHeading } from '../components/PageHeading';
import { localWalletState, subscribeWallet } from '../local-wallet';
export function Settings() {
  const [section, setSection] = useState<'security' | 'network' | 'addresses' | null>(null);
  const vault = useSyncExternalStore(subscribeWallet, localWalletState);
  const items = [
    { id: 'security' as const, title: 'Security & backup', detail: 'Recovery information and device unlock', Icon: ShieldCheck, color: '#e4dcfb' },
    { id: 'network' as const, title: 'Network', detail: 'MegaETH, Ethereum, and custom RPC', Icon: Globe2, color: '#d9edf9' },
    { id: 'addresses' as const, title: 'Connected addresses', detail: 'Receiving defaults and public profile', Icon: Wallet, color: '#ffe2d6' },
  ];
  return <div className="page-content mx-auto flex w-full max-w-[680px] flex-col gap-6">
    <PageHeading title="Settings." description="A few things to make Citrus yours." />
    {section ? <><button type="button" className="inline-flex items-center gap-2 self-start text-sm" onClick={() => setSection(null)}><ArrowLeft size={16} />All settings</button>
      {section === 'network' ? <NetworkSettings /> : section === 'addresses' ? <LinkedAddresses /> : vault === 'absent' ? <p className="text-sm text-ink-muted">Create a Citrus wallet to manage its security and backup here.</p> : <LocalWallet />}
    </> : <><div className="overflow-hidden rounded-2xl border border-edge bg-white">{items.map(({ id, title, detail, Icon, color }) => <button key={id} type="button" onClick={() => setSection(id)} className="flex w-full items-center gap-4 border-b border-edge-soft p-5 text-left last:border-0 hover:bg-sunken"><span style={{ backgroundColor: color }} className="rounded-xl p-3"><Icon size={22} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs text-ink-muted">{detail}</span></span><ChevronRight size={18} /></button>)}</div>
      <Link to="/wallet" search={{ setup: true }} className="text-center text-sm font-semibold underline underline-offset-4">Set up or connect a wallet</Link>
    </>}
  </div>;
}
