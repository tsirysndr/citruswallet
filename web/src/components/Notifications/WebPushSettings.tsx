import { useEffect, useState } from 'react';
import { rpc } from '../../api';
import { Button } from '../ui';

export const supportsPush = () => typeof window !== 'undefined' && window.isSecureContext &&
  'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator;
const preference = 'citrus:web-push-owner';
const save = async (subscription: PushSubscription) => {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys?.auth) throw new Error('Browser did not provide a valid subscription.');
  await rpc.registerWebPush({ endpoint: value.endpoint, p256dh: value.keys.p256dh, auth: value.keys.auth });
};
export function WebPushSettings({ did }: { did: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!supportsPush()) return;
    let disposed = false;
    const refresh = async () => {
      try {
        if (localStorage.getItem(preference) !== did || Notification.permission !== 'granted') {
          if (!disposed) setEnabled(false);
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (disposed) return;
        if (subscription) await save(subscription);
        if (!disposed) setEnabled(!!subscription);
      } catch { if (!disposed) setMessage('Could not refresh browser notifications. Try enabling them again.'); }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { disposed = true; window.removeEventListener('focus', refresh); };
  }, [did]);
  if (!supportsPush()) return <p className="mt-4 text-sm text-ink-muted">Browser push is unavailable here. On iPhone or iPad, add Citrus Wallet to your Home Screen and open it there.</p>;
  const toggle = async () => {
    setBusy(true); setMessage('');
    try {
      // Request permission directly from this click, before any network await.
      if (!enabled && await Notification.requestPermission() !== 'granted') {
        setMessage('Notifications are blocked. Allow them in your browser’s site settings to enable push.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      if (enabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await rpc.unregisterWebPush({ endpoint: subscription.endpoint });
          localStorage.removeItem(preference);
          setEnabled(false);
          await subscription.unsubscribe();
        }
        localStorage.removeItem(preference);
        setEnabled(false);
        return;
      }
      const { publicKey } = await rpc.getWebPushConfig();
      const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      let subscription = await registration.pushManager.getSubscription();
      if (subscription?.options.applicationServerKey &&
        btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') !== publicKey) {
        await subscription.unsubscribe(); subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await save(subscription);
      localStorage.setItem(preference, did);
      setEnabled(true);
      setMessage(registration.waiting ? 'Notifications enabled. Close all Citrus Wallet tabs and reopen to activate the updated notification service.' : 'Notifications enabled, including when this site is closed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update notifications. Please retry.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-4 border-b border-line pb-4">
    <Button disabled={busy} onClick={() => void toggle()}>{busy ? 'Updating…' : enabled ? 'Disable browser notifications' : 'Enable browser notifications'}</Button>
    <p role="status" className="mt-2 text-sm text-ink-muted">{message || 'Get notified when a payment arrives, even when this site is closed.'}</p>
  </section>;
}
