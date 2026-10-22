import { useState } from "react";
import { send } from "../api";
import { balanceOf } from "../balances";
import { useRefresh, useRun, useStatus } from "../hooks";
import { shortAddress } from "../format";
import { useBalances, useSession } from "../queries";
import type { Challenge } from "../types";
import { checkWallet, provider, walletAccount } from "../wallet";
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
} from "./ui";

const hexOf = (message: string) =>
  "0x" +
  Array.from(new TextEncoder().encode(message), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export function WalletPanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data: balances } = useBalances(session);
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();
  const [discoverable, setDiscoverable] = useState(false);

  const signedIn = Boolean(session?.did);
  const address = balances?.address ?? null;
  const onNetwork = balances?.onNetwork ?? false;

  const link = () =>
    run(async () => {
      const network = session!.network;
      const wallet = provider();
      const account = await walletAccount(wallet, network);
      const challenge = await send<Challenge>("/api/challenge", {
        address: account,
        public: discoverable,
      });
      if (challenge.chainId !== network.chainId)
        throw new Error("Server network changed. Reload and try again.");
      status("Review the DID and domain, then sign the linking message in MetaMask…");
      const signature = await wallet.request({
        method: "personal_sign",
        params: [hexOf(challenge.message), account],
      });
      await checkWallet(wallet, account, network);
      await send("/api/verify", { id: challenge.id, signature });
      await refresh();
      status("Wallet linked. Your keys stay in MetaMask.");
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
        Approve a message in MetaMask to prove that you control this address.
        Linking has no gas fee.
      </Hint>
      <Checkbox id="discoverable" checked={discoverable} onChange={setDiscoverable}>
        Allow public payments to this address (first public wallet becomes my
        receiving default)
      </Checkbox>
      <Button className="mt-4 w-full" disabled={!signedIn} onClick={link}>
        Connect MetaMask &amp; link
      </Button>
      {signedIn && address && session && (
        <Balance>
          {onNetwork
            ? `Balance of ${shortAddress(address)}: ${balanceOf(address, session, balances) ?? "unavailable"}`
            : `Switch MetaMask to ${session.network.name} to see this account’s balance.`}
        </Balance>
      )}
      <Hint className="mt-2.5">
        {session?.did
          ? `${session.network.name} · chain ${session.network.chainId} · standard MetaMask accounts`
          : "Sign in with AT Protocol to continue."}
      </Hint>
    </Panel>
  );
}
