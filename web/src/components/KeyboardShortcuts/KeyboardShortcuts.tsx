import { useEffect, useRef, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

const destinations = [
  { key: "a", to: "/", label: "Go to Account" },
  { key: "w", to: "/wallet", label: "Go to Wallet" },
  { key: "p", to: "/payments", label: "Go to Payments" },
  { key: "h", to: "/activity", label: "Go to Activity" },
] as const;
const desktopQuery =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";
const preferenceKey = "citrus-keyboard-shortcuts";

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) !== "off";
    } catch {
      return true;
    }
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const sync = () => {
      setDesktop(media.matches);
      if (!media.matches) {
        dialog.current?.close();
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!desktop || !enabled) return;
    let prefixUntil = 0;
    const clear = () => {
      prefixUntil = 0;
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k" &&
        !event.repeat &&
        !event.isComposing &&
        !event.defaultPrevented &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        clear();
        window.dispatchEvent(new Event("citrus:activity-search"));
        return;
      }
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector("dialog[open]")
      ) {
        clear();
        return;
      }
      const editing = event
        .composedPath()
        .some(
          (node) =>
            node instanceof HTMLElement &&
            (node.isContentEditable ||
              node.matches(
                'input, textarea, select, [role="textbox"], [role="combobox"], [role="slider"], video, audio',
              )),
        );
      if (editing) {
        clear();
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "?") {
        event.preventDefault();
        clear();
        dialog.current?.showModal();
        setOpen(true);
        return;
      }
      if (key === "/" && !event.shiftKey) {
        event.preventDefault();
        clear();
        window.dispatchEvent(new Event("citrus:activity-search"));
        return;
      }
      if (event.shiftKey) {
        clear();
        return;
      }
      if (prefixUntil > Date.now()) {
        clear();
        const destination = destinations.find((item) => item.key === key);
        if (destination) {
          event.preventDefault();
          void navigate({ to: destination.to });
          return;
        }
      }
      if (key === "g") {
        event.preventDefault();
        prefixUntil = Date.now() + 1200;
      } else clear();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", clear);
    window.addEventListener("pointerdown", clear);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointerdown", clear);
    };
  }, [desktop, enabled, navigate]);

  if (!desktop) return null;
  return (
    <>
      <button
        type="button"
        className="keyboard-shortcuts-trigger"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="keyboard-shortcuts"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <Keyboard size={21} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        id="keyboard-shortcuts"
        className="date-dialog keyboard-shortcuts-dialog"
        aria-labelledby="keyboard-shortcuts-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              dialog.current?.close();
          }
        }}
      >
        <div className="date-dialog-inner">
          <header>
            <h2 id="keyboard-shortcuts-title">Keyboard shortcuts</h2>
            <button
              type="button"
              className="date-icon-button"
              aria-label="Close keyboard shortcuts"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
          </header>
          <p className="keyboard-shortcuts-hint">
            Press G, then the next key. Shortcuts pause while you type or use a
            dialog.
          </p>
          <dl className="keyboard-shortcuts-list">
            {destinations.map((item) => (
              <div key={item.key}>
                <dt>{item.label}</dt>
                <dd>
                  <kbd>G</kbd>
                  <span>then</span>
                  <kbd>{item.key.toUpperCase()}</kbd>
                </dd>
              </div>
            ))}
            <div>
              <dt>Quick activity search</dt>
              <dd>
                <kbd>⌘ / Ctrl</kbd>
                <kbd>K</kbd>
              </dd>
            </div>
            <div>
              <dt>Open activity search</dt>
              <dd>
                <kbd>/</kbd>
              </dd>
            </div>
            <div>
              <dt>Show this guide</dt>
              <dd>
                <kbd>?</kbd>
              </dd>
            </div>
            <div>
              <dt>Close the current dialog</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
            </div>
            <div>
              <dt>Move between calendar days</dt>
              <dd>
                <kbd>←</kbd>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <kbd>→</kbd>
              </dd>
            </div>
          </dl>
          <label className="keyboard-shortcuts-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                const value = event.target.checked;
                setEnabled(value);
                try {
                  localStorage.setItem(preferenceKey, value ? "on" : "off");
                } catch {
                  /* Preference still applies for this session. */
                }
              }}
            />
            Enable navigation and search shortcuts
          </label>
        </div>
      </dialog>
    </>
  );
}
