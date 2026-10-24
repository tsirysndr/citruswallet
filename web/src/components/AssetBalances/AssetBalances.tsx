import { AssetLogo } from "../AssetLogo";
import { formatBalance } from "@peachlet/amounts";
import { useAssets } from "../../assets";
import type { Session } from "../../types";
import { ContentSkeleton } from "../ContentSkeleton";
import { Button } from "../ui";
const shortAddress = (address: string) =>
  address.length > 20 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
function WalletAssets({
  session,
  address,
  hidden,
  index,
}: {
  session: Session;
  address: string;
  hidden: boolean;
  index: number;
}) {
  const query = useAssets(session.did, session.network.chainId, address);
  const entries = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.assets)
        .map((row) => [row.asset.id, row]) ?? [],
    ).values(),
  ];
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-bold">Account {index + 1}</p>
        <p
          title={address}
          aria-label={address}
          className="font-mono text-xs font-bold text-ink-muted"
        >
          {shortAddress(address)}
        </p>
      </div>
      {query.isPending && <ContentSkeleton label="Loading assets" />}
      {(query.isError ||
        query.data?.pages.some((page) => !page.discoveryAvailable)) && (
        <p className="text-xs text-ink-muted">
          Some token balances are unavailable. Try refreshing.
        </p>
      )}
      <div className="max-h-64 overflow-y-auto">
        {entries.map(({ asset, balanceAtomic }) => (
          <div key={asset.id} className="flex items-center gap-3 py-3">
            <AssetLogo asset={asset} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-3">
                <strong className="text-sm">{asset.symbol}</strong>
                <span className="break-all text-right font-mono text-base font-extrabold">
                  {hidden
                    ? "••••••"
                    : formatBalance(balanceAtomic, asset.decimals)}
                </span>
              </div>
              <p className="text-xs text-ink-muted">{asset.name}</p>
              {asset.contractAddress && (
                <p
                  title={asset.contractAddress}
                  aria-label={asset.contractAddress}
                  className="font-mono text-xs font-bold text-ink-muted"
                >
                  {shortAddress(asset.contractAddress)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {query.hasNextPage && (
        <Button
          variant="subtle"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more assets
        </Button>
      )}
    </div>
  );
}
export function AssetBalances({
  session,
  hidden,
}: {
  session: Session;
  hidden: boolean;
}) {
  const links = session.links.filter(
    (link) => link.chain_id === session.network.chainId,
  );
  if (!links.length) return null;
  return (
    <section className="ui-panel space-y-5 rounded-[28px] bg-raised p-6 md:p-8">
      <h3 className="text-lg font-semibold">Your assets</h3>
      {links.map((link, index) => (
        <WalletAssets
          index={index}
          key={link.address}
          session={session}
          address={link.address}
          hidden={hidden}
        />
      ))}
    </section>
  );
}
