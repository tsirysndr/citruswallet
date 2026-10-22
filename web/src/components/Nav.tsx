import { Link } from "@tanstack/react-router";
import { screens, type Screen } from "../screens";

type Marks = Partial<Record<Screen, boolean>>;

const Mark = () => (
  <span
    aria-hidden="true"
    className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent ring-2 ring-canvas"
  />
);

export function HeaderNav({ marks }: { marks: Marks }) {
  return (
    <nav aria-label="Sections" className="desktop-nav hidden items-center gap-1 md:flex">
      {screens.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold tracking-[0.02em] no-underline"
          activeProps={{ className: "nav-active" }}
          inactiveProps={{ className: "text-ink-muted hover:text-ink" }}
        >
          <span className="relative flex">
            <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
            {marks[to] && <Mark />}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ marks }: { marks: Marks }) {
  return (
    <nav
      aria-label="Sections"
      className="mobile-nav fixed inset-x-0 bottom-0 z-40 flex md:hidden"
    >
      {screens.map(({ to, icon: Icon, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[12px] font-medium tracking-[0.03em] no-underline"
          activeProps={{ className: "nav-active" }}
          inactiveProps={{ className: "text-ink-muted" }}
        >
          <span className="relative flex">
            <Icon size={21} strokeWidth={1.75} aria-hidden="true" />
            {marks[to] && <Mark />}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
