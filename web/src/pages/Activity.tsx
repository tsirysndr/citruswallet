import { HistoryPanel } from "../components/HistoryPanel";
import { SignedOut } from "../components/SignedOut";
import { useSession } from "../queries";

export function Activity() {
  const { data: session } = useSession();

  if (!session?.did)
    return (
      <SignedOut>Your payment intents are listed once you sign in.</SignedOut>
    );

  return <HistoryPanel advanced className="activity-history" />;
}
