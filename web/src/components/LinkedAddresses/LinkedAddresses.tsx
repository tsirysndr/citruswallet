import { ContentSkeleton } from "../ContentSkeleton";
import { rpc } from "../../api";
import { balanceOf } from "../../balances";
import { useRefresh, useRun, useStatus } from "../../hooks";
import { useBalances, useSession } from "../../queries";
import {
  Badge,
  Button,
  Heading,
  Hint,
  Mono,
  Panel,
  PanelHeading,
} from "../ui";

export function LinkedAddresses({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data: balances, isFetching: balanceLoading } = useBalances(session);
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();

  if (!session || (!session.links.length && !session.addressSyncPending)) return null;

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
                  : `Switch your wallet to ${session.network.name} to read balances.`,
              );
            })
          }
        >
          Refresh balances
        </Button>
      </PanelHeading>
      {session.addressSyncPending && (
        <div className="mb-4">
          <Hint>A public address update or removal is pending. Retry, or sign in again to renew permission.</Hint>
          <Button variant="subtle" onClick={() => run(async () => {
            const result = await rpc.syncAddresses({});
            await refresh();
            status(result.addressSyncPending
              ? "Still pending. Sign in again if repository permission has expired."
              : "Public address records updated.", result.addressSyncPending);
          })}>Retry public record update</Button>
        </div>
      )}
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
                {link.chain_id === 6343 ? "MegaETH testnet" : link.chain_id === 4326 ? "MegaETH" : link.chain_id === 31337 ? "Anvil local" : "Ethereum mainnet"} ·{" "}
                {link.public ? "Public" : "Private"}
                {link.is_default ? " · Receiving default" : ""}
              </Hint>
              {here && balanceLoading && !balances && <ContentSkeleton variant="line" label="Loading balance" />}
              {balance && <p className="mt-1 font-mono text-[13px] text-info tabular-nums">{balance}</p>}
              {here && !balanceLoading && !balance && !balances?.onNetwork && (
                <Hint>Balance hidden · wallet connection unavailable.</Hint>
              )}
            </div>
            <div className="flex w-full flex-wrap gap-2 md:w-auto">
              {link.public && !link.is_default && here && (
                <Button
                  variant="subtle"
                  onClick={() =>
                    run(async () => {
                      await rpc.setDefaultAddress({ address: link.address });
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
                      const result = await rpc.unlinkAddress({ address: link.address });
                      await refresh();
                      status(result.addressSyncPending ? "Wallet unlinked locally. Public record removal is pending." : "Wallet unlinked.");
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
