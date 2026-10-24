import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { theme } from "../../theme";

export function ThemeToggle() {
  const current = useSyncExternalStore(
    theme.subscribe,
    theme.current,
    () => "light" as Theme,
  );
  const dark = current === "dark";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => theme.set(dark ? "light" : "dark")}
      aria-label={`Switch to the ${dark ? "light" : "dark"} theme`}
      className="flex cursor-pointer items-center gap-2 rounded-full border border-edge bg-transparent px-3 py-2 text-[12px] font-semibold tracking-[0.04em] text-ink-muted hover:border-accent hover:text-ink"
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
