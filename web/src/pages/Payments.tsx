import { PageHeading } from "../components/PageHeading";
import { PaymentTools } from "../components/PaymentTools";
import { ReviewPanel } from "../components/ReviewPanel";
import { SignedOut } from "../components/SignedOut";
import { useSession } from "../queries";

export function Payments() {
  const { data: session } = useSession();

  if (!session?.did)
    return (
      <SignedOut>
        Sending assets by handle needs your AT Protocol identity, so the
        recipient’s DID can be pinned to the payment.
      </SignedOut>
    );

  return (
    <div className="page-content flex flex-col gap-6">
      <PageHeading
        title="Send a little something."
        description="A handle, an amount, and you’re on your way."
      />
      <PaymentTools />
      <ReviewPanel />
    </div>
  );
}
