import { localWalletState, subscribeWallet } from "../../local-wallet";
import { useSyncExternalStore } from "react";
import { ContentSkeleton } from "../ContentSkeleton";
import { isMobileWalletBrowser } from "../../mobile-wallet";
import { useState } from "react";
import { metamaskStoreUrl, useMetaMask } from "../../metamask";
import { rpc } from "../../api";
import { balanceOf } from "../../balances";
import { useRefresh, useRun, useStatus } from "../../hooks";
import { shortAddress } from "../../format";
import { useBalances, useSession } from "../../queries";
import { checkWallet, connectWallet, walletAccount } from "../../wallet";
import {
  Badge,
  Balance,
  Button,
  Checkbox,
  Heading,
  Hint,
  Panel,
  PanelHeading,
  Step,
} from "../ui";

const hexOf = (message: string) =>
  "0x" +
  Array.from(new TextEncoder().encode(message), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export function WalletPanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data: balances, isFetching: balanceLoading } = useBalances(session);
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();
  const [discoverable, setDiscoverable] = useState(false);

  const walletState = useSyncExternalStore(subscribeWallet, localWalletState);
  const [mode, setMode] = useState(() => localStorage.getItem("citrus:wallet-mode") || "citrus");
  const builtIn = walletState !== "absent" && mode !== "metamask";
  const hasMetaMask = useMetaMask();
  const signedIn = Boolean(session?.did);
  const address = balances?.address ?? null;
  const onNetwork = balances?.onNetwork ?? false;

  const link = () =>
    run(async () => {
      const network = session!.network;
      const wallet = await connectWallet(network);
      const account = await walletAccount(wallet, network, status);
      const challenge = await rpc.createChallenge({
        address: account,
        public: discoverable,
      });
      if (challenge.chainId !== network.chainId)
        throw new Error("Server network changed. Reload and try again.");
      status(builtIn ? "Linking your Citrus wallet…" : "Review the linking message in MetaMask…");
      const signature = await wallet.request({
        method: "personal_sign",
        params: [hexOf(challenge.message), account],
      });
      await checkWallet(wallet, account, network);
      const result = await rpc.verifyChallenge({ id: challenge.id, signature });
      await refresh();
      status(result.addressSyncPending
        ? "Wallet linked. Public record update is pending; retry below or sign in again."
        : "Wallet linked. Your keys stay on your device.");
    });

  return (
    <Panel className={className}>
      <PanelHeading>
        <Step>02</Step>
        <Heading>Your wallet</Heading>
        <Badge className="ml-auto">
          {session?.links.length ? "Linked" : "Not linked"}
        </Badge>
      </PanelHeading>
      <Hint>
        Link your wallet to your Atmosphere account to send and receive payments.
        Linking has no gas fee.
      </Hint>
      {walletState !== "absent" && <select aria-label="Wallet to use" value={mode} onChange={e => { setMode(e.target.value); localStorage.setItem("citrus:wallet-mode", e.target.value); void refresh(); }}><option value="citrus">Citrus wallet</option><option value="metamask">MetaMask (optional)</option></select>}
      <Checkbox id="discoverable" checked={discoverable} onChange={setDiscoverable}>
        Publish this address to my AT Protocol repository and allow public
        payments (first public wallet becomes my receiving default)
      </Checkbox>
      {builtIn || hasMetaMask || isMobileWalletBrowser() ? (
        <Button className="mt-4 w-full" disabled={!signedIn || (builtIn && walletState === "locked")} onClick={link}>
          {builtIn ? (walletState === "locked" ? "Unlock your wallet above" : "Link Citrus wallet") : isMobileWalletBrowser() ? "Open MetaMask & link" : "Connect MetaMask & link"}
        </Button>
      ) : (
        <div className="mt-4">
          <a
            href={metamaskStoreUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2.5 rounded-[6px] bg-ink px-4 py-3 text-[13px] font-semibold text-white hover:opacity-90"
          >
            <img src="/metamask.png" alt="" width={28} height={28} />
            Install MetaMask for your browser
          </a>
          <Hint className="mt-2">MetaMask was not detected. On mobile, open this site in the MetaMask app’s browser.</Hint>
        </div>
      )}
      {!builtIn && isMobileWalletBrowser() && !hasMetaMask && (
        <Hint className="mt-2">Approve the connection and linking message in MetaMask, then return here.
          {" "}<a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Get the MetaMask app</a>
        </Hint>
      )}
      {signedIn && address && session && (balanceLoading && !balances ? <ContentSkeleton variant="line" label="Loading balance" /> :
        <Balance>
          {onNetwork
            ? `Balance of ${shortAddress(address)}: ${balanceOf(address, session, balances) ?? "unavailable"}`
            : `Switch MetaMask to ${session.network.name} to see this account’s balance.`}
        </Balance>
      )}
      <Hint className="mt-2.5">
        {session?.did
          ? `${session.network.name} · chain ${session.network.chainId} · self-custody`
          : "Sign in with AT Protocol to continue."}
      </Hint>
    </Panel>
  );
}
