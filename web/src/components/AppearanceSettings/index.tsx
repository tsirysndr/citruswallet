import { useSyncExternalStore } from "react";
import { theme } from "../../theme";
export function AppearanceSettings() {
  const dark = useSyncExternalStore(theme.subscribe, theme.current) === "dark";
  return (
    <section className="flex items-center justify-between gap-5 rounded-2xl bg-raised p-5">
      <div>
        <h2 className="text-base font-bold">Dark appearance</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A true-black background. Saved on this device.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label="Dark appearance"
        aria-checked={dark}
        onClick={() => theme.set(dark ? "light" : "dark")}
        className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 ${dark ? "bg-accent" : "bg-edge"}`}
      >
        <span
          className={`size-6 rounded-full bg-ink transition-transform ${dark ? "translate-x-6" : ""}`}
        />
      </button>
    </section>
  );
}
