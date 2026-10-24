import { it, expect } from "vitest";
import { http, HttpResponse } from "msw/http";
import { server } from "../../test/mocks/server";
import { xrpc } from "../../test/mocks/handlers";
import { session, linkedAddress } from "../../test/mocks/fixtures";
import { renderComponent, screen } from "../../test/render";
import { nativeAsset } from "../../assets";
import { AssetBalances } from "./AssetBalances";
it('shows exact asset balances separately and respects balance privacy', async () => {
  const asset = nativeAsset(1);
  server.use(http.get(xrpc('getAssets'), () => HttpResponse.json({ discoveryAvailable: true, assets: [
    { asset, address: linkedAddress.address, balanceAtomic: '1000000000000000001' },
    { asset: { ...asset, id: 'token', kind: 'erc20', symbol: 'USDC', name: 'USD Coin', contractAddress: linkedAddress.address, decimals: 6 }, address: linkedAddress.address, balanceAtomic: '2345678' },
  ] })));
  await renderComponent(<AssetBalances session={{ ...session, links: [linkedAddress] }} hidden={false} />);
  expect(await screen.findByText('1.000000000000000001')).toBeInTheDocument();
  expect(screen.getByText('2.345678')).toBeInTheDocument();
  expect(screen.getByText('Account 1')).toBeInTheDocument();
  expect(screen.getAllByLabelText(linkedAddress.address)[0]).toHaveTextContent(`${linkedAddress.address.slice(0, 8)}…${linkedAddress.address.slice(-6)}`);
});
it('conceals asset amounts when balances are hidden', async () => {
  server.use(http.get(xrpc('getAssets'), () => HttpResponse.json({ discoveryAvailable: true, assets: [{ asset: nativeAsset(1), address: linkedAddress.address, balanceAtomic: '123456789' }] })));
  await renderComponent(<AssetBalances session={{ ...session, links: [linkedAddress] }} hidden />);
  expect(await screen.findByText('••••••')).toBeInTheDocument();
  expect(screen.queryByText('0.000000000123456789')).not.toBeInTheDocument();
});
