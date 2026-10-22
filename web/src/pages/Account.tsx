import { IdentityPanel } from "../components/IdentityPanel";

export function Account() {
  return (
    <>
      <p className="text-[11px] font-bold tracking-[0.18em] text-accent-strong">
        YOUR HANDLE. YOUR WALLET.
      </p>
      <h1 className="my-[22px] text-[clamp(38px,6vw,70px)] leading-[1.05] font-[530] tracking-[-0.055em]">
        Put a name
        <br />
        to your address.
      </h1>
      <p className="max-w-[470px] text-base leading-[1.7] text-ink-soft">
        Link your wallet, send ETH by handle, or invite someone to choose a receiving
        address. Your keys stay in MetaMask.
      </p>
      <div className="mt-[42px] max-w-[560px]">
        <IdentityPanel />
      </div>
      <aside className="mt-5 flex max-w-[650px] gap-3.5 text-xs leading-[1.8] text-ink-faint">
        <span className="text-2xl text-accent">↳</span>
        <p className="m-0">
          Your DID is the stable identity behind your handle. This link proves control
          of both accounts when linked; it does not give this app access to your funds.
        </p>
      </aside>
    </>
  );
}
