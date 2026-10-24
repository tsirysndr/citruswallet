import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  approvalSnapshot,
  answerApproval,
  subscribeApproval,
} from "../../wallet-approval";
import { Button } from "../ui";
export function WalletApproval() {
  const approval = useSyncExternalStore(subscribeApproval, approvalSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (approval) dialog.current?.showModal();
    else dialog.current?.close();
  }, [approval]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="wallet-approval-title"
      className="m-auto w-[min(92vw,440px)] rounded-2xl border border-edge bg-raised p-6 text-ink backdrop:bg-black/25"
      onCancel={(e) => {
        e.preventDefault();
        answerApproval(false);
      }}
    >
      <h2 id="wallet-approval-title" className="text-xl font-semibold">
        Confirm payment
      </h2>
      {approval && (
        <>
          <p className="mt-2 text-sm text-ink-muted">
            {approval.network} · Peachlet wallet
          </p>
          <dl className="my-5 grid gap-3 text-sm">
            <dt>{approval.token ? "Token contract" : "Recipient address"}</dt>
            <dd className="break-all font-mono">{approval.to}</dd>
            <dt>{approval.token ? "Native ETH attached" : "Amount"}</dt>
            <dd className="font-mono">{approval.value} ETH</dd>
            <dt>Maximum network fee</dt>
            <dd className="font-mono">{approval.fee} ETH</dd>
          </dl>
          {approval.token && (
            <p className="mb-4 text-sm">
              This sends the token amount to the recipient you just reviewed.
            </p>
          )}
          <div className="flex gap-3">
            <Button
              keepEnabled
              variant="subtle"
              onClick={() => answerApproval(false)}
            >
              Cancel
            </Button>
            <Button keepEnabled onClick={() => answerApproval(true)}>
              Send payment
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
