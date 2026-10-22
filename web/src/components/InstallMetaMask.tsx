import { isMobileWalletBrowser } from "../mobile-wallet";
import { connectWallet, walletAccount } from "../wallet";
import { useSession } from "../queries";
import { useRefresh, useRun, useStatus } from "../hooks";
import { metamaskStoreUrl, useMetaMask } from "../metamask";

export function InstallMetaMask() {
  const detected = useMetaMask();
  const { data: session } = useSession();
  const run = useRun();
  const refresh = useRefresh();
  const status = useStatus();
  if (!detected && isMobileWalletBrowser()) return (
    <button type="button" disabled={!session} onClick={() => run(async () => {
      status("Approve the connection in MetaMask, then return to Citrus.");
      const wallet = await connectWallet(session!.network);
      await walletAccount(wallet, session!.network);
      await refresh();
      status("MetaMask connected. Link your wallet to verify ownership.");
    })} className="inline-flex shrink-0 items-center gap-2 rounded-[6px] bg-accent px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap text-accent-ink hover:brightness-105 sm:text-xs">
      <img src="/metamask.png" alt="" width={26} height={26} />
      <span>Connect MetaMask</span>
    </button>
  );
  if (detected) return null;
  return (
    <a
      href={metamaskStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-2 rounded-[6px] bg-accent px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap text-accent-ink hover:brightness-105 sm:text-xs"
    >
      <img src="/metamask.png" alt="" width={26} height={26} />
      <span>Install MetaMask</span>
    </a>
  );
}
