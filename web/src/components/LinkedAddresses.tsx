import { remove, send } from "../api";
import { balanceOf } from "../balances";
import { useRefresh, useRun, useStatus } from "../hooks";
import { useBalances, useSession } from "../queries";
import {
  Badge,
  Button,
  Heading,
  Hint,
  Mono,
  Panel,
  PanelHeading,
} from "./ui";

export function LinkedAddresses({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data: balances } = useBalances(session);
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();

  if (!session?.links.length) return null;

  return (
    <Panel className={className}>
      <PanelHeading>
        <Heading>Linked addresses</Heading>
        <Badge tone="good">Verified</Badge>
        <Button
          variant="subtle"
          className="ml-auto"
          onClick={() =>
            run(async () => {
              await refresh();
              status(
                balances?.onNetwork
                  ? "Balances refreshed from your wallet."
                  : `Switch MetaMask to ${session.network.name} to read balances.`,
              );
            })
          }
        >
          Refresh balances
        </Button>
      </PanelHeading>
      {session.links.map((link) => {
        const here = link.chain_id === session.network.chainId;
        const balance = here ? balanceOf(link.address, session, balances) : null;
        return (
          <div
            key={`${link.chain_id}:${link.address}`}
            className="flex flex-wrap items-start gap-3.5 border-t border-edge-soft py-3.5 first:border-t-0 md:flex-nowrap md:items-center"
          >
            <div className="min-w-0 flex-1">
              <Mono>{link.address}</Mono>
              <Hint>
                {link.chain_id === 31337 ? "Anvil local" : "Ethereum mainnet"} ·{" "}
                {link.public ? "Public" : "Private"}
                {link.is_default ? " · Receiving default" : ""}
              </Hint>
              {balance && <p className="mt-1 text-[13px] text-info tabular-nums">{balance}</p>}
              {here && !balance && !balances?.onNetwork && (
                <Hint>Balance hidden · MetaMask is on another network.</Hint>
              )}
            </div>
            <div className="flex w-full flex-wrap gap-2 md:w-auto">
              {link.public && !link.is_default && here && (
                <Button
                  variant="subtle"
                  onClick={() =>
                    run(async () => {
                      await send("/api/links/default", { address: link.address });
                      await refresh();
                      status("Receiving default updated.");
                    })
                  }
                >
                  Make default
                </Button>
              )}
              {here && (
                <Button
                  variant="subtle"
                  onClick={() =>
                    run(async () => {
                      await remove(`/api/links/${link.address}`);
                      await refresh();
                      status("Wallet unlinked.");
                    })
                  }
                >
                  Unlink
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
