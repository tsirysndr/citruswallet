import { ContentSkeleton } from "../ContentSkeleton";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { rpc } from "../../api";
import { forgetInvite, inviteTokenAtom } from "../../atoms";
import { label } from "../../format";
import { useRun, useStatus } from "../../hooks";
import { useInvitation, useSession } from "../../queries";
import { inviteForm } from "../../validation";
import {
  Button,
  FieldError,
  Heading,
  Hint,
  Mono,
  Panel,
  PanelHeading,
  Select,
} from "../ui";

export function InvitePanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const [token, setToken] = useAtom(inviteTokenAtom);
  const { data: invitation, error } = useInvitation(token, session);
  const form = useForm<
    z.input<typeof inviteForm>,
    unknown,
    z.output<typeof inviteForm>
  >({ resolver: zodResolver(inviteForm), defaultValues: { address: "" } });
  const queries = useQueryClient();
  const run = useRun();
  const status = useStatus();

  if (!token) return null;

  const here = (session?.links ?? []).filter(
    (link) => link.chain_id === session!.network.chainId,
  );
  const answerable =
    Boolean(invitation) && ["waiting", "ready"].includes(invitation!.state);

  return (
    <Panel className={className}>
      <PanelHeading>
        <Heading>Payment invitation</Heading>
        <Button
          variant="subtle"
          className="ml-auto"
          onClick={() => {
            setToken(null);
            forgetInvite();
          }}
        >
          Dismiss
        </Button>
      </PanelHeading>
      <p className="m-0 text-[13px]">
        {!session?.did
          ? "Sign in with the AT Protocol account this invitation was intended for."
          : invitation
            ? `${invitation.amount} ETH from ${invitation.senderDid}`
            : ((error as Error | null)?.message ?? "")}
      </p>
      {invitation && session && (
        <Mono>
          Recipient: {invitation.recipientDid} · {session.network.name} ·{" "}
          {label(invitation.state)}
        </Mono>
      )}
      {session?.did && !invitation && !error && <ContentSkeleton variant="card" label="Loading invitation" />}
      <a className="my-3 inline-block text-sm font-semibold underline md:hidden" href={`citruswallet://invite#invite=${token}`}>Open in Citrus Wallet app</a>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ address }) =>
          run(async () => {
            const result = await rpc.acceptInvitation(
              { token, address },
            );
            queries.setQueryData(["invitation", token, session?.did], result.payment);
            status(
              "Receiving address shared. The sender must return and approve the transfer.",
            );
          }),
        )}
      >
        <label htmlFor="invite-wallet" className="mt-4 mb-2.5 block text-xs text-ink-muted">
          Share a receiving wallet with this sender
        </label>
        <Select
          id="invite-wallet"
          aria-invalid={Boolean(form.formState.errors.address)}
          className="font-mono"
          {...form.register("address")}
        >
          <option value="">Choose a linked address</option>
          {here.map((link) => (
            <option key={link.address} value={link.address}>
              {link.address} · {link.public ? "public" : "private"}
            </option>
          ))}
        </Select>
        <FieldError>{form.formState.errors.address?.message}</FieldError>
        <Button type="submit" disabled={!answerable}>
          Use this address for this payment
        </Button>
      </form>
      <Hint className="mt-2.5">
        You must sign in as the intended recipient and link a wallet on this network. A
        private address stays private from other users. The sender will still need to
        approve the transfer.
      </Hint>
      <Hint>
        {invitation?.source === "recipient" && invitation.address
          ? `You selected ${invitation.address}. The sender must return and approve the transfer.`
          : "Link a wallet above, then choose it here. No funds have been deposited for you."}
      </Hint>
    </Panel>
  );
}
