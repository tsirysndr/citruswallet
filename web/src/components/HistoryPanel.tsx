import { useSetAtom } from "jotai";
import { useNavigate } from "@tanstack/react-router";
import { reviewIdAtom } from "../atoms";
import { label } from "../format";
import { useRefresh, useRun, useStatus } from "../hooks";
import { usePayments, useSession } from "../queries";
import { Button, Heading, Hint, Panel, PanelHeading } from "./ui";

export function HistoryPanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data: payments } = usePayments(session);
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();
  const setReviewId = useSetAtom(reviewIdAtom);
  const navigate = useNavigate();

  if (!session?.did) return null;

  return (
    <Panel className={className}>
      <PanelHeading>
        <Heading>Your payment intents</Heading>
        <Button
          variant="subtle"
          className="ml-auto"
          onClick={() =>
            run(async () => {
              await refresh();
              status("Payment intents refreshed.");
            })
          }
        >
          Refresh
        </Button>
      </PanelHeading>
      {(payments ?? []).map((payment) => (
        <div
          key={payment.id}
          className="flex flex-wrap items-start gap-3 border-t border-edge-soft py-4 first:border-t-0 md:flex-nowrap md:items-center"
        >
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="m-0 [overflow-wrap:anywhere]">
              <span className="font-mono tabular-nums">{payment.amount} ETH</span> →{" "}
              {payment.recipientLabel}
            </p>
            <Hint>{label(payment.state)}</Hint>
          </div>
          <Button
            variant="subtle"
            onClick={() => {
              setReviewId(payment.id);
              navigate({ to: "/payments" });
              status("Review the payment details.");
            }}
          >
            Review
          </Button>
        </div>
      ))}
      {!payments?.length && <Hint>No payment intents yet.</Hint>}
      <Hint className="mt-2.5">
        Invitations reserve no funds. “Confirmed” means the matching transaction
        reached the required on-chain confirmations.
      </Hint>
    </Panel>
  );
}
