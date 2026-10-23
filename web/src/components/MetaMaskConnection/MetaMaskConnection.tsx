import { useEffect, useState } from "react";

/** Reopen the existing connection payload after unlock; never start another request. */
export function MetaMaskConnection() {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    const update = (event: Event) => {
      const value: unknown = (event as CustomEvent).detail;
      setUri(typeof value === "string" && value.startsWith("metamask://connect/mwp?") ? value : null);
    };
    window.addEventListener("citrus:metamask-request", update);
    return () => window.removeEventListener("citrus:metamask-request", update);
  }, []);
  if (!uri) return null;
  return (
    <section className="mb-5 rounded-[6px] border border-edge bg-panel p-4 text-sm" aria-label="MetaMask connection" aria-live="polite">
      <p className="font-semibold">Waiting for MetaMask approval</p>
      <p className="mt-1 text-ink-muted">If you unlocked MetaMask but no request appeared, open it again below. Approve the connection, then return to Citrus.</p>
      <a href={uri} className="mt-3 inline-flex items-center gap-2 rounded-[6px] bg-accent px-4 py-3 font-semibold text-accent-ink">
        <img src="/metamask.png" width={24} height={24} alt="" />
        Open MetaMask again
      </a>
      <p className="mt-2 text-xs text-ink-muted">This reopens the same connection request. It does not send a payment.</p>
    </section>
  );
}
