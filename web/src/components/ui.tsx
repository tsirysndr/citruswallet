import { useAtomValue } from "jotai";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { busyAtom } from "../atoms";

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "surface ui-panel rounded-[28px] p-6 md:p-8",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeading({ children }: { children: ReactNode }) {
  return <div className="mb-6 flex items-center gap-2.5">{children}</div>;
}

export const Heading = ({ children }: { children: ReactNode }) => (
  <h2 className="m-0 text-lg font-[600]">{children}</h2>
);

export const Step = ({ children }: { children: ReactNode }) => (
  <span className="rounded-[5px] bg-accent-quiet p-1.5 text-[12px] text-accent-strong">
    {children}
  </span>
);

export function Badge({
  tone = "plain",
  className,
  children,
}: {
  tone?: "plain" | "good";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "rounded-full border px-2.5 py-1.5 text-[12px] tracking-[0.04em] md:text-[12px]",
        tone === "good"
          ? "border-good-edge bg-good-bg text-good"
          : "border-edge text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

const variants = {
  solid: "bg-accent px-4 py-3 font-[650] text-accent-ink enabled:hover:brightness-[1.07]",
  subtle:
    "bg-highlight-bg px-3 py-2 text-[12px] text-highlight enabled:hover:brightness-[1.07]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  keepEnabled?: boolean;
};

/* Every button stops responding while an operation is in flight, unless it is
   one that stays usable throughout. */
export function Button({
  variant = "solid",
  keepEnabled = false,
  disabled,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const busy = useAtomValue(busyAtom);
  return (
    <button
      type={type}
      disabled={disabled || (!keepEnabled && busy)}
      className={cx(
        "cursor-pointer rounded-[6px] border-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function LinkButton({ className, ...rest }: ButtonProps) {
  const busy = useAtomValue(busyAtom);
  return (
    <button
      type="button"
      disabled={rest.disabled || busy}
      className={cx(
        "cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold whitespace-normal text-info underline underline-offset-2 hover:decoration-2 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...rest}
    />
  );
}

export const Label = ({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) => (
  <label htmlFor={htmlFor} className="mb-2.5 block text-xs text-ink-muted">
    {children}
  </label>
);

export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("form-row flex gap-2", className)}>{children}</div>
);

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cx(
      "w-full min-w-0 rounded-[6px] border border-edge bg-sunken p-3 text-[13px] text-ink",
      className,
    )}
    {...rest}
  />
);

export const Select = ({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cx(
      "mr-2.5 mb-3 max-w-full rounded-[6px] border border-edge bg-sunken p-3 text-xs text-ink",
      className,
    )}
    {...rest}
  />
);

export const Hint = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <p className={cx("text-xs leading-[1.7] text-ink-faint", className)}>{children}</p>;

export const Mono = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <p
    className={cx(
      "font-mono text-xs leading-[1.8] [overflow-wrap:anywhere]",
      className,
    )}
  >
    {children}
  </p>
);

export const Balance = ({ children }: { children: ReactNode }) => (
  <p className="mt-2.5 font-mono text-[13px] text-info tabular-nums">{children}</p>
);

export const FieldError = ({ children }: { children?: string }) =>
  children ? (
    <p role="alert" className="mt-2 text-xs leading-[1.5] text-bad">
      {children}
    </p>
  ) : null;

export function Checkbox({
  checked,
  onChange,
  id,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-5 flex items-start gap-[9px] text-xs leading-[1.5]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="shrink-0 accent-accent"
      />
      <span>{children}</span>
    </label>
  );
}
