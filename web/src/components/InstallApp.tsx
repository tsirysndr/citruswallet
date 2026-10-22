import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    sync();
    standalone.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", complete);
    return () => { standalone.removeEventListener("change", sync); window.removeEventListener("beforeinstallprompt", available); window.removeEventListener("appinstalled", complete); };
  }, []);
  if (installed) return null;
  const install = async () => {
    if (!prompt) { dialog.current?.showModal(); return; }
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { dialog.current?.showModal(); }
    finally { setPrompt(null); setBusy(false); }
  };
  return <>
    <button type="button" disabled={busy} onClick={() => void install()} className="inline-flex items-center gap-1.5 font-semibold text-info disabled:opacity-50"><Download size={14} />Install app</button>
    <dialog ref={dialog} className="date-dialog max-w-md text-left" aria-labelledby="install-title">
      <div className="date-dialog-inner">
        <div className="flex items-center justify-between"><h2 id="install-title" className="text-lg font-semibold">Keep Citrus close.</h2><button type="button" className="date-icon-button" aria-label="Close install instructions" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
        <p className="mt-4 text-sm leading-relaxed">Use your browser’s <strong>Install app</strong> or <strong>Add to Home Screen</strong> option. On iPhone or iPad, open Citrus in Safari, tap Share, then Add to Home Screen.</p>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">Payments still need MetaMask. On mobile, tap Connect MetaMask to open the wallet app, approve the request, then return to Citrus. You can also use the MetaMask mobile browser.</p>
        <Button className="mt-5" onClick={() => dialog.current?.close()}>Got it</Button>
      </div>
    </dialog>
  </>;
}
