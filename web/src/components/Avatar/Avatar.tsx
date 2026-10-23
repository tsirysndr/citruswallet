import { useState } from "react";
import { avatarHue, initials } from "../../format";
import type { Actor } from "../../types";
import { cx } from "../ui";

type Known = Pick<Actor, "did" | "handle" | "displayName" | "avatar">;

export function Avatar({ actor, size = "size-9" }: { actor: Known; size?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const shape = cx(size, "shrink-0 rounded-full");

  if (!actor.avatar || failed === actor.avatar) {
    return (
      <div
        aria-hidden="true"
        className={cx(shape, "grid place-items-center text-[15px] font-[650] text-accent-ink")}
        style={{ backgroundColor: `hsl(${avatarHue(actor.did)} 85% 72%)` }}
      >
        {initials(actor)}
      </div>
    );
  }
  return (
    <img
      src={actor.avatar}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(actor.avatar)}
      className={cx(shape, "bg-edge-soft object-cover")}
    />
  );
}
