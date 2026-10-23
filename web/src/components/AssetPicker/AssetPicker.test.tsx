import { it, expect, vi } from "vitest";
import { useState } from "react";
import { http, HttpResponse } from "msw/http";
import { server } from "../../test/mocks/server";
import { xrpc } from "../../test/mocks/handlers";
import { session, linkedAddress } from "../../test/mocks/fixtures";
import { renderComponent, screen, waitFor } from "../../test/render";
import { nativeAsset, type Asset } from "../../assets";
import { AssetPicker } from "./AssetPicker";
const token: Asset = { ...nativeAsset(1), id: 'eip155:1/erc20:0x4444444444444444444444444444444444444444', kind: 'erc20', contractAddress: '0x4444444444444444444444444444444444444444', symbol: 'USDC', name: 'USD Coin', decimals: 6 };
it('discovers holdings and uses on-chain metadata before selecting a token', async () => {
  const selected = vi.fn();
  server.use(
    http.get(xrpc('getAssets'), () => HttpResponse.json({ discoveryAvailable: true, assets: [{ asset: token, address: linkedAddress.address, balanceAtomic: '1234567' }] })),
    http.get(xrpc('getAsset'), ({ request }) => { expect(new URL(request.url).searchParams.get('assetId')).toBe(token.id); return HttpResponse.json({ asset: { ...token, symbol: 'VERIFIED' }, address: linkedAddress.address, balanceAtomic: '1234567' }); }),
  );
  function Picker() { const [value, setValue] = useState(nativeAsset(1)); return <AssetPicker session={{ ...session, links: [linkedAddress] }} value={value} onChange={asset => { selected(asset); setValue(asset); }} />; }
  const { user } = await renderComponent(<Picker />);
  await user.click(screen.getByRole('button', { name: 'ETH · Choose asset' }));
  await user.click((await screen.findByText('USDC')).closest('button')!);
  await waitFor(() => expect(selected).toHaveBeenCalledWith(expect.objectContaining({ decimals: 6, symbol: 'VERIFIED' })));
  expect(screen.getByRole('button', { name: 'VERIFIED · Choose asset' })).toBeInTheDocument();
});
it('keeps the current asset when token verification fails', async () => {
  const selected = vi.fn();
  server.use(http.get(xrpc('getAssets'), () => HttpResponse.json({ discoveryAvailable: false, assets: [] })),
    http.get(xrpc('getAsset'), () => HttpResponse.json({ error: 'InvalidRequest', message: 'Invalid token decimals.' }, { status: 400 })));
  const { user } = await renderComponent(<AssetPicker session={{ ...session, links: [linkedAddress] }} value={nativeAsset(1)} onChange={selected} />);
  await user.click(screen.getByRole('button', { name: 'ETH · Choose asset' }));
  await user.type(screen.getByRole('searchbox', { name: 'Search assets or paste token contract' }), token.contractAddress!);
  await user.click(screen.getByRole('button', { name: 'Look up token' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid token decimals');
  expect(selected).not.toHaveBeenCalled();
});

it('opens a focused modal, filters instantly and restores focus when closed', async () => {
  server.use(http.get(xrpc('getAssets'), () => HttpResponse.json({ discoveryAvailable: true, assets: [
    { asset: nativeAsset(1), address: linkedAddress.address, balanceAtomic: '1000000000000000000' },
    { asset: token, address: linkedAddress.address, balanceAtomic: '1234567' },
  ] })));
  const { user } = await renderComponent(<AssetPicker session={{ ...session, links: [linkedAddress] }} value={nativeAsset(1)} onChange={() => {}} />);
  const trigger = screen.getByRole('button', { name: 'ETH · Choose asset' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Choose asset' })).toBeInTheDocument();
  const search = screen.getByRole('searchbox');
  expect(search).toHaveFocus();
  await screen.findByText('USD Coin');
  await user.type(search, 'usdc');
  expect(screen.queryByText('Ether')).not.toBeInTheDocument();
  expect(screen.getByText('USD Coin')).toBeInTheDocument();
  await user.clear(search);
  await user.type(search, 'unmatched');
  expect(screen.getByText('No assets match your search.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close asset picker' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
