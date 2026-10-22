import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useActorSearch } from "../queries";
import type { Actor } from "../types";
import { Avatar } from "./Avatar";
import { cx, Input } from "./ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  id: string;
  value: string;
  invalid?: boolean;
  excludeDid?: string | null;
  onChange: (value: string) => void;
  onPick: (actor: Actor) => void;
};

export function Typeahead({
  id,
  value,
  invalid,
  excludeDid,
  onChange,
  onPick,
  onBlur,
  ...rest
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);

  const typed = value.trim().toLowerCase();
  const searchable = typed.length >= 2 && !typed.startsWith("did:");

  useEffect(() => {
    setOpen(false);
    setQuery("");
    if (!searchable || !searchActive) {
      return;
    }
    const timer = setTimeout(() => {
      setQuery(typed);
      setOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [typed, searchable, searchActive]);

  // Detach from outdated searches immediately so their fetches are aborted.
  const { data } = useActorSearch(open && query === typed ? query : "");
  const actors = open && query === typed
    ? (data ?? []).filter((actor) => actor.did !== excludeDid)
    : [];

  useEffect(() => setActive(-1), [query, excludeDid]);
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const listId = `${id}-suggestions`;
  /* A DID is not an @-name, so the prefix steps aside as soon as one is typed. */
  const named = !value.startsWith("did:");
  const close = () => {
    setSearchActive(false);
    setOpen(false);
    setActive(-1);
  };
  const pick = (actor: Actor) => {
    onChange(actor.handle);
    close();
    onPick(actor);
  };
  const move = (step: number) => {
    if (actors.length) setActive((at) => (at + step + actors.length) % actors.length);
  };

  return (
    <div className="relative flex min-w-0 grow">
      {named && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[13px] text-ink-faint"
        >
          @
        </span>
      )}
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={actors.length > 0}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        className={cx("font-mono", named && "pl-[26px]", invalid && "border-bad")}
        value={value}
        onChange={(event) => {
          setActive(-1);
          setSearchActive(true);
          onChange(event.target.value.replace(/^@+/, ""));
        }}
        onBlur={(event) => {
          setTimeout(close, 0);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Enter" && active >= 0 && active < actors.length) {
            event.preventDefault();
            pick(actors[active]!);
          } else if (event.key === "Escape" && searchActive) {
            event.stopPropagation();
            close();
          } else if (event.key === "Tab") {
            close();
          }
        }}
        {...rest}
      />
      <ul
        ref={list}
        id={listId}
        role="listbox"
        hidden={actors.length === 0}
        className="popover-shadow absolute top-[calc(100%+4px)] right-0 left-0 z-30 m-0 max-h-[19rem] list-none overflow-y-auto rounded-[6px] border border-edge bg-raised p-1.5"
      >
        {actors.map((actor, index) => (
          <li
            key={actor.did}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            /* mousedown, so the pick lands before the input loses focus. */
            onMouseDown={(event) => {
              event.preventDefault();
              pick(actor);
            }}
            onMouseEnter={() => setActive(index)}
            className="flex cursor-pointer items-center gap-[11px] rounded-[6px] px-[9px] py-[7px] aria-selected:bg-accent-quiet"
          >
            <Avatar actor={actor} />
            <div className="flex min-w-0 flex-col gap-px">
              {actor.displayName && (
                <span className="truncate text-[13.5px] font-semibold">
                  {actor.displayName}
                </span>
              )}
              <span
                className={
                  actor.displayName
                    ? "truncate font-mono text-xs text-ink-muted"
                    : "truncate font-mono text-[13.5px] font-semibold"
                }
              >
                @{actor.handle}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
