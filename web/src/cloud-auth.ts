import {
  driveScope,
  dropboxAuthorization,
  exchangeDropboxCode,
  type CloudProvider,
} from "@peachlet/wallet-core";
type GoogleResponse = { access_token?: string; error?: string; scope?: string };
type GoogleApi = {
  accounts: {
    oauth2: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleResponse) => void;
        error_callback: () => void;
      }): { requestAccessToken(options: { prompt: string }): void };
    };
  };
};
const googleId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || "";
const dropboxId = import.meta.env.VITE_DROPBOX_APP_KEY || "";
let script: Promise<void> | undefined;
const relayKey = "peachlet-cloud-callback";
const callbackUrl = (data: unknown) => {
  const relay = data as { type?: unknown; url?: unknown } | null;
  return relay?.type === "peachlet-cloud-callback" &&
    typeof relay.url === "string"
    ? relay.url
    : undefined;
};
function takeCallback(): string | undefined {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(relayKey);
    if (saved !== null) localStorage.removeItem(relayKey);
  } catch {
    return undefined;
  }
  if (!saved) return undefined;
  let relay: unknown;
  try {
    relay = JSON.parse(saved);
  } catch {
    return undefined;
  }
  const at = (relay as { at?: unknown } | null)?.at;
  // An abandoned attempt must not complete a later one.
  return typeof at === "number" && Date.now() - at < 300000
    ? callbackUrl(relay)
    : undefined;
}
const googleApi = () => (window as unknown as { google?: GoogleApi }).google;
export const cloudConfigured = (provider: CloudProvider) =>
  Boolean(provider === "google" ? googleId : dropboxId);
export function prepareGoogleAuth() {
  if (!googleId || googleApi()) return Promise.resolve();
  return (script ??= new Promise<void>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = "https://accounts.google.com/gsi/client";
    element.async = true;
    const timer = setTimeout(() => {
      script = undefined;
      element.remove();
      reject(new Error("Google sign-in could not load. Try again."));
    }, 15000);
    element.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    element.onerror = () => {
      clearTimeout(timer);
      script = undefined;
      element.remove();
      reject(new Error("Google sign-in could not load. Try again."));
    };
    document.head.append(element);
  }));
}
export function connectCloud(
  provider: CloudProvider,
  signal?: AbortSignal,
): Promise<string> {
  if (!cloudConfigured(provider))
    return Promise.reject(
      new Error(
        `${provider === "google" ? "Google Drive" : "Dropbox"} backup is not configured yet.`,
      ),
    );
  if (provider === "google") {
    const google = googleApi();
    if (!google)
      return Promise.reject(
        new Error("Google sign-in is still loading. Try again."),
      );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Google sign-in timed out. Try again.")),
        180000,
      );
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleId,
        scope: driveScope,
        callback: (result) => {
          clearTimeout(timer);
          if (
            !result.error &&
            result.access_token &&
            result.scope?.split(" ").includes(driveScope)
          )
            resolve(result.access_token);
          else reject(new Error("Google Drive permission was not granted."));
        },
        error_callback: () => {
          clearTimeout(timer);
          reject(new Error("Google sign-in was cancelled or blocked."));
        },
      });
      client.requestAccessToken({ prompt: "select_account" });
    });
  }
  const auth = dropboxAuthorization(
    dropboxId,
    `${window.location.origin}/cloud-callback.html`,
  );
  try {
    localStorage.removeItem(relayKey);
  } catch {
    /* storage blocked; the other relays still deliver */
  }
  const popup = window.open(
    auth.url,
    "peachlet-cloud",
    "popup,width=520,height=680",
  );
  if (!popup)
    return Promise.reject(
      new Error("Allow the sign-in popup, then try again."),
    );
  /* Dropbox's own Cross-Origin-Opener-Policy puts the popup in another browsing
     context group, so this handle reports closed and loses postMessage while the
     user is still signing in: popup.closed is not a cancellation here. The
     callback relays through same-origin storage instead, and only the explicit
     cancel or the deadline ends the wait. Google Identity Services reports its
     own cancellation, so only this flow honours the signal. */
  return new Promise((resolve, reject) => {
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("peachlet-cloud");
    } catch {
      /* unsupported; the storage relay covers it */
    }
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("message", receive);
      window.removeEventListener("storage", stored);
      signal?.removeEventListener("abort", cancel);
      channel?.removeEventListener("message", relayed);
      channel?.close();
      try {
        popup.close();
      } catch {
        /* a severed handle cannot close it */
      }
    };
    const finish = (url: string) => {
      cleanup();
      void exchangeDropboxCode(auth, url).then(resolve, reject);
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== popup) return;
      const url = callbackUrl(event.data);
      if (url) finish(url);
    };
    const relayed = (event: MessageEvent) => {
      const url = callbackUrl(event.data);
      if (url) finish(url);
    };
    const stored = () => {
      const url = takeCallback();
      if (url) finish(url);
    };
    const cancel = () => {
      cleanup();
      reject(new Error("Dropbox sign-in was cancelled."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Dropbox sign-in did not finish. Try again."));
    }, 300000);
    const poll = setInterval(stored, 500);
    window.addEventListener("message", receive);
    window.addEventListener("storage", stored);
    channel?.addEventListener("message", relayed);
    signal?.addEventListener("abort", cancel);
    if (signal?.aborted) cancel();
  });
}
