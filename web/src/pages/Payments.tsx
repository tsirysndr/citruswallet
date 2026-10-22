import { PaymentTools } from "../components/PaymentTools";
import { ReviewPanel } from "../components/ReviewPanel";
import { SignedOut } from "../components/SignedOut";
import { useSession } from "../queries";

export function Payments() {
  const { data: session } = useSession();

  if (!session?.did)
    return (
      <SignedOut>
        Sending ETH by handle needs your AT Protocol identity, so the recipient’s DID
        can be pinned to the payment.
      </SignedOut>
    );

  return (
    <div className="flex flex-col gap-[18px]">
      <PaymentTools />
      <ReviewPanel />
    </div>
  );
}
