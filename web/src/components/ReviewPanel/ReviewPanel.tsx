import { ContentSkeleton } from "../ContentSkeleton";
import { PaymentMedia } from "../PaymentMedia";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { rpc } from "../../api";
import { acknowledgedAtom, invitationUrlAtom, reviewIdAtom } from "../../atoms";
import { forgetBroadcast, pendingBroadcast, rememberBroadcast } from "../../broadcast";
import { label } from "../../format";
import { useRefresh, useRun, useStatus } from "../../hooks";
import { usePayment, useSession } from "../../queries";
import type { Payment } from "../../types";
import { recoverForm } from "../../validation";
import { checkWallet, connectWallet, walletAccount } from "../../wallet";
import {
  Badge,
  Button,
  Checkbox,
  FieldError,
  Heading,
  Hint,
  Input,
  Label,
  Panel,
  PanelHeading,
  Row,
} from "../ui";

export function ReviewPanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const reviewId = useAtomValue(reviewIdAtom);
  const { data: payment, isPending, error } = usePayment(reviewId, session);
  const [acknowledged, setAcknowledged] = useAtom(acknowledgedAtom);
  const [invitationUrl, setInvitationUrl] = useAtom(invitationUrlAtom);
  const recover = useForm<
    z.input<typeof recoverForm>,
    unknown,
    z.output<typeof recoverForm>
  >({ resolver: zodResolver(recoverForm), defaultValues: { txHash: "" } });
  const queries = useQueryClient();
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();

  /* A changed destination always clears the sender's review acknowledgement. */
  const pinned = payment && `${payment.id}|${payment.revision}|${payment.address}`;
  useEffect(() => {
    setAcknowledged(false);
  }, [pinned, setAcknowledged]);

  if (reviewId && session?.did && isPending) return <Panel className={className}><ContentSkeleton variant="card" label="Loading payment" /></Panel>;
  if (reviewId && session?.did && error) return <Panel className={className}><Hint>Could not load payment. Try refreshing.</Hint></Panel>;
  if (!payment || !session?.did) return null;

  const did = session.did;
  const isSender = payment.senderDid === did;
  const cache = (updated: Payment) =>
    queries.setQueryData(["payment", payment.id], updated);

  const details: [string, string][] = [
    ["Recipient", `${payment.recipientLabel} (name at creation)`],
    ["Pinned DID", payment.recipientDid],
    ["Network", `${session.network.name} · ${payment.chainId}`],
    ["Amount", `${payment.amount} ETH + network fee`],
    ["Address", payment.address ?? "Recipient has not selected an address"],
    ["Expires", new Date(payment.expiresAt).toLocaleString()],
  ];
  if (!isSender) details.unshift(["Sender", payment.sender?.handle ? `@${payment.sender.handle}` : payment.senderDid]);
  if (payment.fromAddress) details.push(["From", payment.fromAddress]);
  if (payment.txHash)
    details.push(
      ["Transaction", payment.txHash],
      ["Confirmations", `${payment.confirmationsRequired} required`],
    );

  const sendable = isSender && ["ready", "prepared"].includes(payment.state);
  const recoverable =
    isSender && Boolean(payment.attemptId) &&
    ["prepared", "expired", "submitted"].includes(payment.state);

  const pay = () =>
    run(async () => {
      if (!acknowledged)
        throw new Error("Review and acknowledge the payment details first.");
      const shown = payment;
      if (!shown.address) throw new Error("The recipient has no receiving address.");
      const wallet = await connectWallet(session.network);
      const fromAddress = await walletAccount(wallet, session.network);
      if (pendingBroadcast(did))
        throw new Error(
          "Check the previous MetaMask prompt and recover its transaction hash before sending another payment.",
        );
      const prepared = await rpc.preparePayment({ id: shown.id,
        revision: shown.revision,
        address: shown.address,
        fromAddress,
      });
      const tx = prepared.transaction;
      /* Check the response against the sender's reviewed values before
         invoking the wallet. */
      if (
        prepared.payment.recipientDid !== shown.recipientDid ||
        tx.to.toLowerCase() !== shown.address?.toLowerCase() ||
        BigInt(tx.value) !== BigInt(shown.amountWei) ||
        tx.chainId !== session.network.chainIdHex ||
        tx.from.toLowerCase() !== fromAddress.toLowerCase() ||
        tx.data !== "0x"
      )
        throw new Error("Prepared transaction differs from your review. Refresh before sending.");
      await checkWallet(wallet, fromAddress, session.network);
      const pending = { id: shown.id, attemptId: prepared.attemptId };
      rememberBroadcast(did, pending);
      cache(prepared.payment);
      status("Review the address, amount, network fee, and nonce in MetaMask.");
      let txHash: string;
      try {
        txHash = await wallet.request({ method: "eth_sendTransaction", params: [tx] });
      } catch (error: any) {
        if (error.code === 4001) forgetBroadcast(did);
        throw error;
      }
      rememberBroadcast(did, { ...pending, txHash });
      const result = await rpc.submitPayment(
        { id: pending.id, attemptId: pending.attemptId, txHash },
      );
      forgetBroadcast(did);
      cache(result.payment);
      await refresh();
      status(
        `Transaction ${txHash}. ${label(result.payment.state)}. Refresh to check confirmations.`,
      );
    });

  return (
    <Panel className={className}>
      <PanelHeading>
        <Heading>Review payment</Heading>
        <Badge status={payment.state} className="ml-auto">{label(payment.state)}</Badge>
      </PanelHeading>
      <dl className="grid grid-cols-[85px_minmax(0,1fr)] gap-3 text-xs leading-[1.6] md:grid-cols-[110px_minmax(0,1fr)] md:text-[13px]">
        {details.map(([term, value]) => (
          <div key={term} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-ink-faint">{term}</dt>
            <dd className="m-0 font-mono [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <PaymentMedia key={payment.media?.url} media={payment.media} />
      {payment.description && (
        <div className="mt-5 rounded-[6px] bg-sunken p-4">
          <p className="mb-2 text-xs text-ink-muted">Description · only in Citrus Wallet</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{payment.description}</p>
        </div>
      )}
      {payment.error && <p className="mt-3 text-xs text-bad">{payment.error}</p>}

      {sendable && (
        <>
          <Checkbox checked={acknowledged} onChange={setAcknowledged}>
            I checked the recipient DID, full Ethereum address, network, and amount
            shown above.
          </Checkbox>
          <Button
            className="mt-4 w-full"
            disabled={!acknowledged || !session.paymentsEnabled}
            onClick={pay}
          >
            Review in MetaMask &amp; send
          </Button>
          <Hint className="mt-2.5">
            Use a wallet linked to your own DID. MetaMask shows the final transaction
            and network fee before you approve.
          </Hint>
        </>
      )}

      {isSender && payment.state === "waiting" && (
        <div className="mt-4">
          <Button
            onClick={() =>
              run(async () => {
                const result = await rpc.createInvitation({ id: payment.id });
                setInvitationUrl(result.invitationUrl);
                status(
                  "Invitation generated. Earlier invitation links for this payment no longer work.",
                );
              })
            }
          >
            Generate invitation link
          </Button>
          <Hint className="mt-2.5">
            Share this link with the intended recipient. Funds stay in your wallet.
          </Hint>
          {invitationUrl && (
            <div className="mt-4">
              <Label htmlFor="invitation-url">Invitation URL</Label>
              <Input id="invitation-url" readOnly value={invitationUrl} className="mb-2.5" />
              <Button
                variant="subtle"
                onClick={() =>
                  run(async () => {
                    await navigator.clipboard.writeText(invitationUrl);
                    status("Invitation link copied.");
                  })
                }
              >
                Copy link
              </Button>
            </div>
          )}
        </div>
      )}

      {recoverable && (
        <div className="mt-5">
          <Label htmlFor="recover-hash">
            Already broadcast? Attach the original transaction hash
          </Label>
          <form
            noValidate
            onSubmit={recover.handleSubmit(({ txHash }) =>
              run(async () => {
                if (!payment.attemptId) throw new Error("No payment attempt to recover.");
                const result = await rpc.submitPayment(
                  { id: payment.id, attemptId: payment.attemptId, txHash },
                );
                cache(result.payment);
                await refresh();
                status(label(result.payment.state));
              }),
            )}
          >
            <Row>
              <Input
                id="recover-hash"
                placeholder="0x…"
                autoComplete="off"
                aria-invalid={Boolean(recover.formState.errors.txHash)}
                className="font-mono"
                {...recover.register("txHash")}
              />
              <Button type="submit">Check transaction</Button>
            </Row>
            <FieldError>{recover.formState.errors.txHash?.message}</FieldError>
          </form>
          <Button
            variant="subtle"
            className="mt-2.5"
            onClick={() => {
              forgetBroadcast(did);
              setAcknowledged(false);
              status(
                "Review the same prepared transaction again. Check MetaMask for an existing transfer before approving another request.",
              );
            }}
          >
            No transaction was sent — review again
          </Button>
          <Hint className="mt-2.5">
            If MetaMask broadcast a transaction but the page lost the response, find
            its hash in your wallet. Do not create a second payment to retry it.
          </Hint>
        </div>
      )}

      <div className="mt-[18px] flex flex-wrap gap-2.5">
        <Button
          variant="subtle"
          onClick={() =>
            run(async () => {
              await refresh();
              status(label(payment.state));
            })
          }
        >
          Refresh status
        </Button>
        {isSender && ["waiting", "ready"].includes(payment.state) && (
          <Button
            variant="subtle"
            onClick={() =>
              run(async () => {
                const result = await rpc.cancelPayment({ id: payment.id });
                cache(result.payment);
                await refresh();
                status("Payment intent cancelled. No funds were reserved.");
              })
            }
          >
            Cancel intent
          </Button>
        )}
      </div>
    </Panel>
  );
}
