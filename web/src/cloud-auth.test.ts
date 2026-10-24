import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock('@peachlet/wallet-core', async importOriginal => ({ ...await importOriginal<typeof import('@peachlet/wallet-core')>(), exchangeDropboxCode: mocks.exchange }));
const severedPopup = () => ({ closed: true, close: vi.fn() }) as unknown as Window;
async function dropboxAuth() {
  vi.stubEnv('VITE_DROPBOX_APP_KEY', 'test-app-key');
  vi.resetModules();
  return (await import('./cloud-auth')).connectCloud;
}
const relay = (url: string, at = Date.now()) => {
  localStorage.setItem('peachlet-cloud-callback', JSON.stringify({ type: 'peachlet-cloud-callback', url, at }));
  window.dispatchEvent(new StorageEvent('storage', { key: 'peachlet-cloud-callback' }));
};
beforeEach(() => { mocks.exchange.mockResolvedValue('dropbox-token'); });
// Dropbox's sign-in page carries its own COOP, which severs the popup handle:
// a closed-looking popup must not be reported as a cancelled sign-in.
it('completes a Dropbox sign-in relayed through storage while the popup reports closed', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(severedPopup());
  const connectCloud = await dropboxAuth();
  const pending = connectCloud('dropbox');
  expect(open).toHaveBeenCalledOnce();
  const url = 'http://localhost:3000/cloud-callback.html?code=auth-code&state=request-state';
  relay(url);
  await expect(pending).resolves.toBe('dropbox-token');
  expect(mocks.exchange).toHaveBeenCalledWith(expect.objectContaining({ redirectUri: 'http://localhost:3000/cloud-callback.html' }), url);
  expect(localStorage.getItem('peachlet-cloud-callback')).toBeNull();
});
it('ignores a stale callback left by an abandoned attempt', async () => {
  vi.spyOn(window, 'open').mockReturnValue(severedPopup());
  const connectCloud = await dropboxAuth();
  const pending = connectCloud('dropbox');
  relay('http://localhost:3000/cloud-callback.html?code=old-code&state=old-state', Date.now() - 600000);
  const controller = new AbortController();
  const cancelled = connectCloud('dropbox', controller.signal);
  controller.abort();
  await expect(cancelled).rejects.toThrow('Dropbox sign-in was cancelled.');
  expect(mocks.exchange).not.toHaveBeenCalled();
  relay('http://localhost:3000/cloud-callback.html?code=auth-code&state=request-state');
  await expect(pending).resolves.toBe('dropbox-token');
});
