import { OnboardingSignIn } from '../OnboardingSignIn';
import { useAtomValue } from 'jotai';
import { busyAtom } from '../../atoms';
import { requestUnlock } from '../../wallet-unlock';
import { useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Copy, Wallet, Link2 } from 'lucide-react';
import { stringToHex } from 'viem';
import { localBalanceAddress, localWalletState, subscribeWallet } from '../../local-wallet';
import { connectWallet, walletAccount, checkWallet, detectedMetaMask } from '../../wallet';
import { isMobileWalletBrowser } from '../../mobile-wallet';
import { metamaskStoreUrl } from '../../metamask';
import { rpc } from '../../api';
import { useSession } from '../../queries';
import { useRefresh, useRun, useStatus } from '../../hooks';
import { LocalWallet } from '../LocalWallet';
import { WalletIllustration } from '../WalletIllustration';
import { Button, Hint, Panel } from '../ui';

export function configuredAddress() {
  return localStorage.getItem('citrus:wallet-mode') === 'metamask'
    ? localStorage.getItem('citrus:metamask-address') : localBalanceAddress();
}
export function WalletSetup({ onFinished, restart = false }: { onFinished?: () => void; restart?: boolean }) {
  const { data: session } = useSession();
  const vault = useSyncExternalStore(subscribeWallet, localWalletState);
  const refresh = useRefresh(), run = useRun(), status = useStatus();
  const busy = useAtomValue(busyAtom);
  const existing = vault !== 'absent' || Boolean(localStorage.getItem('citrus:metamask-address'));
  const [kind, setKind] = useState<'citrus' | 'metamask'>(() => vault !== 'absent' && localStorage.getItem('citrus:wallet-mode') !== 'metamask' ? 'citrus' : 'metamask');
  const [stage, setStage] = useState<'choice' | 'create' | 'import' | 'link' | 'signin' | 'done'>(() => !restart && existing ? session?.did ? 'link' : 'signin' : 'choice');
  const [editing, setEditing] = useState(restart || Boolean(onFinished));
  const links = session?.links.filter(link => link.chain_id === session.network.chainId) || [];
  const current = configuredAddress();
  const linked = links.find(link => current && link.address.toLowerCase() === current.toLowerCase()) || (!existing ? links.find(link => link.is_default) || links[0] : undefined);
  const ready = Boolean(session?.did) && (stage === 'done' || (!editing && Boolean(linked)));
  const signingIn = !session?.did && stage === 'signin';
  const [address, setAddress] = useState(current || linked?.address || '');
  const switchWallet = (selection: 'citrus' | 'metamask') => {
    if (busy || selection === kind) return;
    localStorage.setItem('citrus:wallet-mode', selection);
    setKind(selection);
    const nextAddress = configuredAddress();
    setAddress(nextAddress || '');
    const alreadyLinked = links.some(link => nextAddress && link.address.toLowerCase() === nextAddress.toLowerCase());
    setEditing(!alreadyLinked);
    setStage(alreadyLinked ? 'done' : selection === 'citrus' && vault === 'absent' ? 'choice' : 'link');
    void refresh();
    if (selection === 'citrus' && vault === 'locked') void requestUnlock().catch(() => {});
  };
  const choose = (selection: 'citrus' | 'metamask', action?: 'import') => {
    setKind(selection); setEditing(true);
    localStorage.setItem('citrus:wallet-mode', selection);
    setStage(selection === 'metamask' || vault !== 'absent' ? 'link' : action || 'create');
  };
  const connect = () => run(async () => {
    if (!session) throw new Error('Reconnect to Citrus and try again.');
    localStorage.setItem('citrus:wallet-mode', kind);
    const provider = await connectWallet(session.network);
    const account = await walletAccount(provider, session.network, status);
    if (kind === 'metamask') localStorage.setItem('citrus:metamask-address', account);
    setAddress(account);
    if (session.did) {
      status(kind === 'metamask' ? 'Approve the wallet-linking message in MetaMask.' : 'Linking your wallet…');
      const challenge = await rpc.createChallenge({ address: account, public: true });
      if (challenge.chainId !== session.network.chainId) throw new Error('Network changed. Please try again.');
      const signature = await provider.request({ method: 'personal_sign', params: [stringToHex(challenge.message), account] });
      await checkWallet(provider, account, session.network);
      await rpc.verifyChallenge({ id: challenge.id, signature });
      await rpc.setDefaultAddress({ address: account });
      await refresh();
    }
    status(session.did ? 'Wallet linked and set as your receiving default.' : 'Wallet connected. Sign in to finish setup.');
    setStage(session.did ? 'done' : 'signin');
  });
  const created = () => { setAddress(localBalanceAddress() || ''); setStage(session?.did ? 'link' : 'signin'); };
  const needsInstall = kind === 'metamask' && !detectedMetaMask() && !isMobileWalletBrowser();
  return <div className="mx-auto w-full max-w-[560px] font-sans">
    {session?.did && !onFinished && <fieldset disabled={busy} className="mb-6">
      <legend className="mb-2 text-sm font-semibold">Wallet to use</legend>
      <div className="flex gap-1 rounded-xl bg-sunken p-1">
        {(['citrus', 'metamask'] as const).map(value => <label key={value} className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${kind === value ? 'bg-accent text-accent-ink' : 'text-ink-muted'} ${busy ? 'cursor-wait opacity-60' : ''}`}>
          <input className="sr-only" type="radio" name="wallet-provider" value={value} checked={kind === value} onChange={() => switchWallet(value)} />
          {value === 'citrus' ? <Wallet size={18} aria-hidden="true" /> : <img src="/metamask.png" alt="" className="size-[18px]" />}
          {value === 'citrus' ? 'Citrus Wallet' : 'MetaMask'}
        </label>)}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Choose which wallet to pay with. Switching does not move funds or change your receiving address.</p>
    </fieldset>}
    {!ready && <div className="mb-7 flex items-center justify-between text-xs text-ink-muted">
      <span>WALLET SETUP</span><span>{signingIn ? 'Final step · Sign in' : stage === 'choice' ? '1 · Choose' : stage === 'link' ? 'Connect your account' : '2 · Secure'}</span>
    </div>}
    {signingIn ? <OnboardingSignIn /> : ready ? <Panel className="text-center"><WalletIllustration variant="ready" className="mx-auto mb-4 w-60 max-w-full" />
      <h1 className="text-3xl font-semibold">{session?.did ? 'Your wallet is ready.' : 'A wallet of your own.'}</h1>
      <p className="mt-3 text-sm leading-6 text-ink-muted">{session?.did ? `Ready to receive on ${session.network.name}. Your wallet address is linked to your Atmosphere account.` : 'Sign in next to link this wallet to your Atmosphere account.'}</p>
      {(address || linked?.address) && <div className="mt-6 rounded-xl bg-sunken p-4 text-left"><p className="mb-2 text-xs text-ink-muted">Your address</p><div className="flex items-center gap-3"><p className="min-w-0 flex-1 break-all font-mono text-sm">{address || linked?.address}</p><button type="button" aria-label="Copy wallet address" className="p-2" onClick={() => run(async () => { await navigator.clipboard.writeText(address || linked!.address); status('Address copied.'); })}><Copy size={19} /></button></div></div>}
      {onFinished && <Button className="mt-6 w-full" onClick={onFinished}>Open Citrus Wallet <ArrowRight size={17} className="ml-2 inline" /></Button>}
    </Panel> : stage === 'choice' ? <>
      <WalletIllustration className="mx-auto mb-3 w-64 max-w-full" />
      <h1 className="text-center text-3xl font-semibold">Make yourself at home.</h1><p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-ink-muted">Choose how you’d like to use your wallet. Your keys always stay with you.</p>
      <div className="mt-8 grid gap-3">
        <button type="button" onClick={() => choose('citrus')} className="flex items-center gap-4 rounded-2xl border border-edge bg-white p-5 text-left transition hover:border-ink"><span className="rounded-xl bg-accent p-3"><Wallet size={24} /></span><span className="flex-1"><strong className="block text-base">{vault === 'absent' ? 'Create a Citrus wallet' : 'Use my Citrus wallet'}</strong><span className="mt-1 block text-sm text-ink-muted">{vault === 'absent' ? 'A fresh start. No extension needed.' : 'Continue with the wallet on this device.'}</span></span><ArrowRight size={18} /></button>
        <button type="button" onClick={() => choose('metamask')} className="flex items-center gap-4 rounded-2xl border border-edge bg-white p-5 text-left transition hover:border-ink"><span className="rounded-xl bg-[#ffe0d7] p-3"><Link2 size={24} /></span><span className="flex-1"><strong className="block text-base">Connect MetaMask</strong><span className="mt-1 block text-sm text-ink-muted">Keep using the wallet you already know.</span></span><ArrowRight size={18} /></button>
      </div>
      {vault === 'absent' && <p className="mt-6 text-center text-sm text-ink-muted">Have a recovery phrase? <button type="button" className="font-semibold text-ink underline underline-offset-4" onClick={() => choose('citrus', 'import')}>Restore a wallet</button></p>}
    </> : stage === 'create' || stage === 'import' ? <LocalWallet key={stage} initialAction={stage} onCreated={created} onCancel={() => setStage('choice')} /> : <Panel className="text-center">
      <WalletIllustration variant="connect" className="mx-auto mb-4 w-60 max-w-full" />
      <h1 className="text-2xl font-semibold">{session?.did ? 'Your handle, meet your wallet.' : 'Bring your wallet along.'}</h1>
      <p className="mt-3 text-sm leading-6 text-ink-muted">{session?.did ? 'Your wallet address will be linked to your Atmosphere account and set as your default for receiving payments.' : 'Connect MetaMask to get started. You’ll link your Atmosphere account after signing in.'}</p>
      {session?.did && <Hint className="mt-3">Your receiving address will be public. Linking is free and never moves funds.</Hint>}
      {needsInstall ? <a href={metamaskStoreUrl()} target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 font-semibold text-white"><img src="/metamask.png" alt="" className="size-6" />Install MetaMask</a> : <Button className="mt-6 w-full" onClick={connect}>{session?.did ? 'Link my wallet' : 'Connect MetaMask'}</Button>}
      <button type="button" className="mt-5 inline-flex items-center gap-2 text-sm text-ink-muted" onClick={() => setStage('choice')}><ArrowLeft size={15} />Choose a different wallet</button>
    </Panel>}
  </div>;
}
