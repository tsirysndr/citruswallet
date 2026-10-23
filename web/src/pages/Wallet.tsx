import { NetworkSettings } from "../components/NetworkSettings";
import { LocalWallet } from "../components/LocalWallet";
import { PageHeading } from "../components/PageHeading";
import { InvitePanel } from "../components/InvitePanel";
import { LinkedAddresses } from "../components/LinkedAddresses";
import { WalletPanel } from "../components/WalletPanel";

export function Wallet() {
  return (
    <div className="page-content flex flex-col gap-6"><PageHeading title="Your wallet." description="A home for your addresses. Connected to you." />
      <LocalWallet />
      <div className="wallet-connect">
        <WalletPanel />
      </div>
      <LinkedAddresses />
      <InvitePanel />
      <NetworkSettings />
    </div>
  );
}
