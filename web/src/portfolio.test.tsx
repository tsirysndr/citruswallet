import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { renderComponent, screen } from './test/render';
import { server } from './test/mocks/server';
import { xrpc } from './test/mocks/handlers';
import { session, linkedAddress } from './test/mocks/fixtures';
import { usePortfolio } from './portfolio';
const contract = '0x4444444444444444444444444444444444444444';
const token = { address: linkedAddress.address, balanceAtomic: '10000000', usdPrice: '1.00', asset: { id: `eip155:1/erc20:${contract}`, chainId: 1, chain: 'eip155:1', kind: 'erc20', contractAddress: contract, decimals: 6, symbol: 'USD', name: 'Token' } };
function Summary({ chainId = 1, native = '1000000000000000000' }: { chainId?: number; native?: string | null }) {
  const value = usePortfolio({ ...session, network: { ...session.network, chainId }, links: [{ ...linkedAddress, chain_id: chainId }, { ...linkedAddress, chain_id: chainId }] }, native);
  return <div>{!value.supported ? 'No USD value' : value.loading ? 'Loading' : `${value.formatted ?? 'Unavailable'} ${value.partial ? 'partial' : 'complete'}`}</div>;
}
it('includes every asset page, deduplicates overlapping tokens and linked wallets', async () => {
  let calls = 0;
  server.use(http.get(xrpc('getEthPrice'), () => HttpResponse.json({ usd: '2000', updatedAt: Date.now(), source: 'Coinbase' })),
    http.get(xrpc('getAssets'), ({ request }) => { calls++; const next = new URL(request.url).searchParams.has('cursor'); return HttpResponse.json({ assets: [token], discoveryAvailable: true, ...(!next ? { cursor: 'page2' } : {}) }); }));
  await renderComponent(<Summary />);
  expect(await screen.findByText('$2,010.00 complete')).toBeVisible(); expect(calls).toBe(2);
});
it('marks totals partial when discovery or token pricing is unavailable', async () => {
  server.use(http.get(xrpc('getEthPrice'), () => HttpResponse.json({ usd: '2000', updatedAt: Date.now(), source: 'Coinbase' })),
    http.get(xrpc('getAssets'), () => HttpResponse.json({ assets: [{ ...token, usdPrice: undefined }], discoveryAvailable: false })));
  await renderComponent(<Summary />); expect(await screen.findByText('$2,000.00 partial')).toBeVisible();
});
it('estimates testnet ETH using the same market rate', async () => {
  server.use(http.get(xrpc('getEthPrice'), () => HttpResponse.json({ usd: '2000', updatedAt: Date.now(), source: 'Coinbase' })),
    http.get(xrpc('getAssets'), () => HttpResponse.json({ assets: [], discoveryAvailable: true })));
  await renderComponent(<Summary chainId={6343} />); expect(await screen.findByText('$2,000.00 complete')).toBeVisible();
});
it('shows unavailable instead of zero when both pricing and discovery fail', async () => {
  server.use(http.get(xrpc('getEthPrice'), () => HttpResponse.json({ error: 'Unavailable' }, { status: 503 })),
    http.get(xrpc('getAssets'), () => HttpResponse.json({ error: 'Unavailable' }, { status: 503 })));
  await renderComponent(<Summary />); expect(await screen.findByText('Unavailable partial')).toBeVisible();
});

it('uses API native balances when the wallet provider is unavailable on testnet', async () => {
  const asset = { id: 'eip155:6343/slip44:60', chain: 'eip155:6343', chainId: 6343, kind: 'native', contractAddress: null, decimals: 18, symbol: 'ETH', name: 'Ether' };
  server.use(http.get(xrpc('getEthPrice'), () => HttpResponse.json({ usd: '2000', updatedAt: Date.now(), source: 'Coinbase' })),
    http.get(xrpc('getAssets'), () => HttpResponse.json({ assets: [{ address: linkedAddress.address, asset, balanceAtomic: '2000000000000000000' }], discoveryAvailable: true })));
  await renderComponent(<Summary chainId={6343} native={null} />);
  expect(await screen.findByText('$4,000.00 complete')).toBeVisible();
});
