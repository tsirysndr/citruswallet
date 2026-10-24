import { driveScope, dropboxAuthorization, exchangeDropboxCode, type CloudProvider } from '@peachlet/wallet-core';
type GoogleResponse = { access_token?: string; error?: string; scope?: string };
type GoogleApi = { accounts: { oauth2: { initTokenClient(options: { client_id: string; scope: string; callback: (response: GoogleResponse) => void; error_callback: () => void }): { requestAccessToken(options: { prompt: string }): void } } } };
const googleId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '';
const dropboxId = import.meta.env.VITE_DROPBOX_APP_KEY || '';
let script: Promise<void> | undefined;
const googleApi = () => (window as unknown as { google?: GoogleApi }).google;
export const cloudConfigured = (provider: CloudProvider) => Boolean(provider === 'google' ? googleId : dropboxId);
export function prepareGoogleAuth() {
  if (!googleId || googleApi()) return Promise.resolve();
  return script ??= new Promise<void>((resolve, reject) => {
    const element = document.createElement('script'); element.src = 'https://accounts.google.com/gsi/client'; element.async = true;
    const timer = setTimeout(() => { script = undefined; element.remove(); reject(new Error('Google sign-in could not load. Try again.')); }, 15000);
    element.onload = () => { clearTimeout(timer); resolve(); };
    element.onerror = () => { clearTimeout(timer); script = undefined; element.remove(); reject(new Error('Google sign-in could not load. Try again.')); };
    document.head.append(element);
  });
}
export function connectCloud(provider: CloudProvider): Promise<string> {
  if (!cloudConfigured(provider)) return Promise.reject(new Error(`${provider === 'google' ? 'Google Drive' : 'Dropbox'} backup is not configured yet.`));
  if (provider === 'google') {
    const google = googleApi();
    if (!google) return Promise.reject(new Error('Google sign-in is still loading. Try again.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Google sign-in timed out. Try again.')), 180000);
      const client = google.accounts.oauth2.initTokenClient({ client_id: googleId, scope: driveScope,
        callback: result => { clearTimeout(timer); if (!result.error && result.access_token && result.scope?.split(' ').includes(driveScope)) resolve(result.access_token); else reject(new Error('Google Drive permission was not granted.')); },
        error_callback: () => { clearTimeout(timer); reject(new Error('Google sign-in was cancelled or blocked.')); },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }
  const auth = dropboxAuthorization(dropboxId, `${window.location.origin}/cloud-callback.html`);
  const popup = window.open(auth.url, 'peachlet-cloud', 'popup,width=520,height=680');
  if (!popup) return Promise.reject(new Error('Allow the sign-in popup, then try again.'));
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener('message', receive); popup.close(); };
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== popup || event.data?.type !== 'peachlet-cloud-callback' || typeof event.data.url !== 'string') return;
      cleanup(); void exchangeDropboxCode(auth, event.data.url).then(resolve, reject);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Dropbox sign-in timed out. Try again.')); }, 180000);
    const poll = setInterval(() => { if (popup.closed) { cleanup(); reject(new Error('Dropbox sign-in was cancelled.')); } }, 500);
    window.addEventListener('message', receive);
  });
}
