import { useSearch } from "@tanstack/react-router";
import { InvitePanel } from "../components/InvitePanel";
import { WalletSetup } from "../components/WalletSetup";
export function Wallet() {
  const search = useSearch({ strict: false }) as { setup?: boolean };
  return (
    <div className="page-content flex flex-col gap-6 py-4">
      <WalletSetup key={String(search.setup)} restart={search.setup} />
      <InvitePanel />
    </div>
  );
}
