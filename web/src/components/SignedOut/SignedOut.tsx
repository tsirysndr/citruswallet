import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Fingerprint } from "lucide-react";
import { Hint } from "../ui";

export function SignedOut({ children }: { children: string }) {
  return (
    <section className="signed-out-card">
      <div className="signed-out-icon">
        <Fingerprint size={44} strokeWidth={1.3} />
      </div>
      <p className="eyebrow">IT STARTS WITH YOU</p>
      <h1>
        Your handle.
        <br />
        Your way in.
      </h1>
      <Hint>{children}</Hint>
      <Link to="/" className="brand-cta">
        Sign in to get started <ArrowUpRight size={22} />
      </Link>
    </section>
  );
}
