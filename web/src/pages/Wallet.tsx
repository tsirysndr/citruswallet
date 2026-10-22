import { InvitePanel } from "../components/InvitePanel";
import { LinkedAddresses } from "../components/LinkedAddresses";
import { WalletPanel } from "../components/WalletPanel";

export function Wallet() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="max-w-[560px]">
        <WalletPanel />
      </div>
      <LinkedAddresses />
      <InvitePanel />
    </div>
  );
}
