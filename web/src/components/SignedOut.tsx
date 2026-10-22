import { Link } from "@tanstack/react-router";
import { Heading, Hint, Panel, PanelHeading } from "./ui";

export function SignedOut({ children }: { children: string }) {
  return (
    <Panel className="max-w-[560px]">
      <PanelHeading>
        <Heading>Sign in first</Heading>
      </PanelHeading>
      <Hint>{children}</Hint>
      <Link
        to="/"
        className="mt-4 inline-block text-xs font-semibold text-info underline underline-offset-2 hover:decoration-2"
      >
        Go to your account ↗
      </Link>
    </Panel>
  );
}
