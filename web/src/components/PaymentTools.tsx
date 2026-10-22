import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { rpc } from "../api";
import { invitationUrlAtom, reviewIdAtom } from "../atoms";
import { useRefresh, useRun, useStatus } from "../hooks";
import { useSession } from "../queries";
import type { Actor, Recipient } from "../types";
import { amountForm, recipientForm } from "../validation";
import { Typeahead } from "./Typeahead";
import { Avatar } from "./Avatar";
import {
  Badge,
  Button,
  FieldError,
  Heading,
  Hint,
  Input,
  Label,
  Mono,
  Panel,
  PanelHeading,
  Row,
  Step,
} from "./ui";

type Resolved = { identifier: string; recipient: Recipient; actor: Actor };

export function PaymentTools({ className }: { className?: string }) {
  const { data: session } = useSession();
  const queries = useQueryClient();
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();
  const setReviewId = useSetAtom(reviewIdAtom);
  const setInvitationUrl = useSetAtom(invitationUrlAtom);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const recipient = useForm<
    z.input<typeof recipientForm>,
    unknown,
    z.output<typeof recipientForm>
  >({ resolver: zodResolver(recipientForm), defaultValues: { recipient: "" } });

  const amount = useForm<
    z.input<typeof amountForm>,
    unknown,
    z.output<typeof amountForm>
  >({ resolver: zodResolver(amountForm), defaultValues: { amount: "", description: "" } });

  if (!session?.did) return null;

  const resolve = (identifier: string, selected?: Actor) =>
    run(async () => {
      setResolved(null);
      recipient.clearErrors("recipient");
      let found: Recipient;
      try {
        found = await rpc.resolveRecipient({ identifier });
        if (found.did === session.did)
          throw new Error("You cannot send ETH to yourself. Choose another account.");
      } catch (error) {
        recipient.setError("recipient", {
          type: "validate",
          message: error instanceof Error ? error.message : "Could not resolve recipient.",
        });
        throw error;
      }
      setResolved({
        identifier,
        recipient: found,
        actor: {
          did: found.did,
          handle: found.handle ?? "",
          displayName: selected?.did === found.did ? selected.displayName : null,
          avatar: selected?.did === found.did ? selected.avatar : null,
        },
      });
      status("Recipient identity verified. Check the DID before creating the intent.");
    });

  const create = (value: string, description?: string) =>
    run(async () => {
      if (!resolved) throw new Error("Resolve the recipient first.");
      const result = await rpc.createPayment(
        {
          identifier: resolved.identifier,
          expectedDid: resolved.recipient.did,
          amount: value,
          ...(description ? { description } : {}),
        },
      );
      queries.setQueryData(["payment", result.payment.id], result.payment);
      setReviewId(result.payment.id);
      await refresh();
      const waiting = result.payment.state === "waiting";
      setInvitationUrl(waiting ? (result.invitationUrl ?? null) : null);
      status(
        waiting
          ? "Share the invitation with your recipient. Funds stay in your wallet."
          : "Payment intent created. Review it before opening MetaMask.",
      );
    });

  return (
    <Panel className={className}>
      <PanelHeading>
        <Step>03</Step>
        <Heading>Send ETH by handle</Heading>
        <Badge className="ml-auto">{session.network.name}</Badge>
      </PanelHeading>
      <form
        noValidate
        onSubmit={recipient.handleSubmit((values) => resolve(values.recipient))}
      >
        <Label htmlFor="recipient">Recipient handle or DID</Label>
        <Row className="payment-form-row">
          <Controller
            control={recipient.control}
            name="recipient"
            render={({ field, fieldState }) => (
              <Typeahead
                id="recipient"
                excludeDid={session.did}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  recipient.clearErrors("recipient");
                  setResolved(null);
                }}
                onBlur={field.onBlur}
                onPick={(actor) => recipient.handleSubmit((v) => resolve(v.recipient, actor))()}
                invalid={Boolean(fieldState.error)}
                placeholder="alice.bsky.social"
                maxLength={2048}
              />
            )}
          />
          <Button type="submit">Resolve &amp; review</Button>
        </Row>
        <FieldError>{recipient.formState.errors.recipient?.message}</FieldError>
      </form>

      {resolved && (
        <form
          noValidate
          className="mt-6"
          onSubmit={amount.handleSubmit((values) => create(values.amount, values.description))}
        >
          <div className="mb-4 flex items-center gap-3">
            <Avatar actor={resolved.actor} size="size-10" />
            <div className="min-w-0">
              {resolved.actor.displayName && (
                <p className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">
                  {resolved.actor.displayName}
                </p>
              )}
              <p className="m-0 font-mono text-[13px] [overflow-wrap:anywhere]">
                {resolved.recipient.handle
                  ? `@${resolved.recipient.handle}`
                  : "Recipient DID"}
              </p>
              <Mono>{resolved.recipient.did}</Mono>
            </div>
          </div>
          <Mono>
            {resolved.recipient.address
              ? `Receiving address: ${resolved.recipient.address}`
              : "No public receiving address. Create an intent and invite them to choose a wallet."}
          </Mono>
          <div className="my-4">
            <Label htmlFor="payment-description">Description <span className="text-ink-faint">(optional)</span></Label>
            <textarea
              id="payment-description"
              rows={3}
              maxLength={500}
              placeholder="What’s this payment for?"
              aria-describedby="description-hint"
              aria-invalid={Boolean(amount.formState.errors.description)}
              className="w-full resize-y rounded-[6px] border border-edge bg-sunken p-3 text-[13px] text-ink"
              {...amount.register("description")}
            />
            <p id="description-hint" className="mt-1 text-xs leading-relaxed text-ink-faint">Visible to you and the recipient in Citrus Wallet. Never published on-chain or to AT Protocol. Up to 500 characters.</p>
            <FieldError>{amount.formState.errors.description?.message}</FieldError>
          </div>
          <Label htmlFor="amount">Amount in ETH</Label>
          <Row className="payment-form-row">
            <Controller
              control={amount.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  id="amount"
                  type="text"
                  placeholder="0.01"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldState.error)}
                  className="font-mono tabular-nums"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^[0-9]*([.,][0-9]*)?$/.test(value)) field.onChange(value);
                  }}
                />
              )}
            />
            <Button type="submit">Create payment intent</Button>
          </Row>
          <FieldError>{amount.formState.errors.amount?.message}</FieldError>
          <Hint className="mt-2.5">
            The recipient’s DID is pinned when you create the intent. No funds move at
            this step.
          </Hint>
        </form>
      )}

      <Hint className="mt-2.5">
        {session.paymentsEnabled
          ? "Direct ETH transfers · funds leave only after MetaMask approval."
          : "Recipient setup and invitations are available. Set ETH_RPC_URL on the server to enable sending and receipt verification."}
      </Hint>
    </Panel>
  );
}
