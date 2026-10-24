import { it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { WalletSetup } from './index';
import { renderComponent, screen, waitFor } from '../../test/render';
import { server } from '../../test/mocks/server';
import { xrpc } from '../../test/mocks/handlers';
import { address, signedOut } from '../../test/mocks/fixtures';

function wallet() {
  window.ethereum = { isMetaMask: true, request: vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address];
    if (method === 'eth_chainId') return '0x1';
    if (method === 'personal_sign') return '0x1234';
    throw new Error(`Unexpected wallet call: ${method}`);
  }) };
}
it('verifies the chosen address before setting the public receiving default', async () => {
  wallet();
  const calls: string[] = [];
  server.use(
    http.post(xrpc('createChallenge'), async ({ request }) => {
      expect(await request.json()).toEqual({ address, public: true }); calls.push('challenge');
      return HttpResponse.json({ id: 'challenge', address, chainId: 1, message: 'Link wallet', expiresAt: '2027-01-01T00:00:00Z' });
    }),
    http.post(xrpc('verifyChallenge'), async ({ request }) => {
      expect(await request.json()).toEqual({ id: 'challenge', signature: '0x1234' }); calls.push('verify');
      return HttpResponse.json({ links: [] });
    }),
    http.post(xrpc('setDefaultAddress'), async ({ request }) => {
      expect(await request.json()).toEqual({ address }); calls.push('default');
      return HttpResponse.json({ links: [] });
    }),
  );
  const { user } = await renderComponent(<WalletSetup onFinished={() => {}} />);
  await user.click(screen.getByRole('button', { name: /Connect MetaMask/ }));
  await user.click(screen.getByRole('button', { name: 'Link my wallet' }));
  expect(await screen.findByRole('button', { name: /Open Peachlet/ })).toBeVisible();
  expect(calls).toEqual(['challenge', 'verify', 'default']);
});
it('does not complete setup when setting the receiving default fails', async () => {
  wallet();
  let attempted = false;
  server.use(
    http.post(xrpc('createChallenge'), () => HttpResponse.json({ id: 'challenge', address, chainId: 1, message: 'Link wallet', expiresAt: '2027-01-01T00:00:00Z' })),
    http.post(xrpc('verifyChallenge'), () => HttpResponse.json({ links: [] })),
    http.post(xrpc('setDefaultAddress'), () => { attempted = true; return HttpResponse.json({ error: 'Unavailable', message: 'Try again' }, { status: 503 }); }),
  );
  const { user } = await renderComponent(<WalletSetup onFinished={() => {}} />);
  await user.click(screen.getByRole('button', { name: /Connect MetaMask/ }));
  await user.click(screen.getByRole('button', { name: 'Link my wallet' }));
  await waitFor(() => expect(attempted).toBe(true));
  expect(screen.queryByRole('button', { name: /Open Peachlet/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Link my wallet' })).toBeVisible();
});

it('ends anonymous wallet connection at handle sign-in, and resumes there after reload', async () => {
  wallet();
  server.use(http.get(xrpc('getSession'), () => HttpResponse.json(signedOut)));
  const finished = vi.fn();
  const view = await renderComponent(<WalletSetup onFinished={finished} />);
  await view.user.click(screen.getByRole('button', { name: /Connect MetaMask/ }));
  await view.user.click(screen.getByRole('button', { name: 'Connect MetaMask' }));
  expect(await screen.findByRole('button', { name: 'Sign In' })).toBeVisible();
  expect(screen.queryByText(/One last step:/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open Peachlet/ })).not.toBeInTheDocument();
  expect(finished).not.toHaveBeenCalled();
  view.unmount();
  await renderComponent(<WalletSetup onFinished={finished} />);
  expect(await screen.findByRole('button', { name: 'Sign In' })).toBeVisible();
});
