import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { CitrusMark } from "../CitrusMark";
import { Link } from "@tanstack/react-router";
import { screens, type Screen } from "../../screens";

type Marks = Partial<Record<Screen, boolean>>;

const Mark = () => (
  <span
    aria-hidden="true"
    className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent ring-2 ring-canvas"
  />
);

export function SidebarNav({ marks, collapsed, onToggle, network }: {
  marks: Marks;
  collapsed: boolean;
  onToggle: () => void;
  network: string;
}) {
  return (
    <aside className="app-sidebar" aria-label="Sidebar">
      <div className="sidebar-heading">
      <Link to="/" className="brand-logo sidebar-brand" aria-label="Citrus Wallet">
        <span className="logo-mark"><CitrusMark /></span>
        {!collapsed && <span>Citrus<span className="logo-wallet"> Wallet</span></span>}
      </Link>
      <button type="button" className="sidebar-toggle" onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed} aria-controls="sidebar-sections">
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>
      </div>
      <nav id="sidebar-sections" aria-label="Sections" className="sidebar-nav">
        {screens.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
            aria-label={label} title={collapsed ? label : undefined}
            className="sidebar-link"
            activeProps={{ className: "nav-active", "aria-current": "page" }}
            inactiveProps={{ className: "text-ink-muted" }}>
            <span className="relative flex">
              <Icon size={21} strokeWidth={1.75} aria-hidden="true" />
              {marks[to] && <Mark />}
            </span>
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>
      <div className="sidebar-network" title={network}>
        <span aria-hidden="true" className="sidebar-network-dot" />
        <span className={collapsed ? "sr-only" : ""}>{network}</span>
      </div>
    </aside>
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
