import { ContentSkeleton } from "../ContentSkeleton";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { rpc } from "../../api";
import { accountBalance } from "../../balances";
import { inviteTokenAtom } from "../../atoms";
import { useRefresh, useRun, useStatus } from "../../hooks";
import { useBalances, useProfile, useSession } from "../../queries";
import type { Actor } from "../../types";
import AtmosphereApps from "../AtmosphereApps";
import { Avatar } from "../Avatar";
import { Typeahead } from "../Typeahead";
import { signInForm } from "../../validation";
import {
  Badge,
  Balance,
  Button,
  FieldError,
  Heading,
  Hint,
  Label,
  LinkButton,
  Mono,
  Panel,
  PanelHeading,
  Row,
  Step,
} from "../ui";

type SignIn = z.input<typeof signInForm>;

export function IdentityPanel({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { data: profile, isFetching: profileLoading } = useProfile(session?.did);
  const { data: balances, isFetching: balanceLoading } = useBalances(session);
  const run = useRun();
  const status = useStatus();
  const refresh = useRefresh();
  const invite = useAtomValue(inviteTokenAtom);
  const form = useForm<SignIn, unknown, z.output<typeof signInForm>>({
    resolver: zodResolver(signInForm),
    defaultValues: { identifier: "" },
  });

  const signedIn = Boolean(session?.did);
  const actor: Actor | null = session?.did
    ? (profile ?? { did: session.did, handle: "", displayName: null, avatar: null })
    : null;
  const total = session && signedIn ? accountBalance(session, balances) : null;

  const start = (body: Record<string, unknown>, message: string) =>
    run(async () => {
      status(message);
      const { url } = await rpc.startLogin( body);
      window.location.assign(url);
    });

  return (
    <Panel className={className}>
      <PanelHeading>
        <Step>01</Step>
        <Heading>Your identity</Heading>
        <Badge tone={signedIn ? "good" : "plain"} className="ml-auto">
          {signedIn ? "Connected" : "Not connected"}
        </Badge>
      </PanelHeading>

      {!signedIn && (
        <form
          noValidate
          onSubmit={form.handleSubmit(({ identifier }) =>
            start({ identifier }, "Finding your account provider…"),
          )}
        >
          <p className="my-6 text-center text-base leading-6 text-ink-muted">Sign in with your Atmosphere Account</p>
          <AtmosphereApps />
          <p className="my-5 text-center text-sm text-ink-muted"><a href="https://atproto.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">What is an atmosphere account?</a></p>
          <Label htmlFor="identifier">Handle</Label>
          <Row>
            <Controller
              control={form.control}
              name="identifier"
              render={({ field, fieldState }) => (
                <Typeahead
                  id="identifier"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  onPick={() => {}}
                  invalid={Boolean(fieldState.error)}
                  placeholder="you.bsky.social"
                  maxLength={253}
                />
              )}
            />
            <Button type="submit">Sign in ↗</Button>
          </Row>
          <FieldError>{form.formState.errors.identifier?.message}</FieldError>
          <Hint className="mt-2.5">
            By continuing, you agree to our <Link to="/terms" className="underline underline-offset-2">Terms and Conditions</Link>.
            {" "}Read our <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
          </Hint>
          <Hint className="mt-2.5">
            You’ll sign in with your account provider.{" "}

          </Hint>
          <Hint>
            Don’t have an account?{" "}
            <LinkButton
              onClick={() => start({ create: true }, "Opening account creation…")}
            >
              Create one
            </LinkButton>
          </Hint>
        </form>
      )}

      {signedIn && actor && session && (
        <>
          {profileLoading && !profile ? <ContentSkeleton rows={1} label="Loading profile" /> : <div className="mb-4 flex items-center gap-3">
            <Avatar actor={actor} size="size-[46px]" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="m-0 truncate text-[17px] font-[650]">
                {actor.displayName ?? actor.handle ?? "Signed in"}
              </p>
              <p className="m-0 truncate font-mono text-[14px] text-ink-muted">
                {actor.handle ? `@${actor.handle}` : "Handle unavailable"}
              </p>
            </div>
          </div>}
          {balanceLoading && !balances ? <ContentSkeleton variant="line" label="Loading balance" /> : total && <Balance>{total}</Balance>}
          <p className="mt-4 mb-2.5 text-xs text-ink-muted">Authenticated DID</p>
          <Mono>{session.did}</Mono>
          <Button
            variant="subtle"
            className="mt-2"
            onClick={() =>
              run(async () => {
                await rpc.logout({});
                await refresh();
                status("Signed out.");
              })
            }
          >
            Sign out
          </Button>
          {invite && (
            <Hint className="mt-4">
              A payment invitation is waiting under{" "}
              <Link
                to="/wallet"
                className="font-semibold text-info underline underline-offset-2"
              >
                Wallet
              </Link>
              .
            </Hint>
          )}
        </>
      )}
    </Panel>
  );
}
