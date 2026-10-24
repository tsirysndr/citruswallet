import { it, expect } from "vitest";
import { waitFor } from '@testing-library/react';
import { renderComponent, screen } from "../../test/render";
import { PaymentTools } from "./PaymentTools";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
import { alice, bob, payment, session } from "../../test/mocks/fixtures";
it("blocks sending to the signed-in user after resolving a recipient", async () => {
  server.use(
    http.post(xrpc("resolveRecipient"), () =>
      HttpResponse.json({
        did: alice.did,
        handle: alice.handle,
        chainId: 1,
        address: null,
      }),
    ),
    http.get(xrpc("resolveRecipient"), () =>
      HttpResponse.json({
        did: alice.did,
        handle: alice.handle,
        chainId: 1,
        address: null,
      }),
    ),
  );
  const { user } = await renderComponent(<PaymentTools />);
  await user.type(
    await screen.findByRole("combobox", { name: "Recipient handle or DID" }),
    alice.handle,
  );
  await user.click(screen.getByRole("button", { name: "Resolve & review" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "You cannot send ETH to yourself",
  );
  expect(
    screen.queryByRole("button", { name: "Create payment intent" }),
  ).not.toBeInTheDocument();
});
it("does not render a payment form while signed out", async () => {
  server.use(
    http.get(xrpc("getSession"), () =>
      HttpResponse.json({ ...session, did: null }),
    ),
  );
  const { container } = await renderComponent(<PaymentTools />);
  expect(container.querySelector("form")).toBeNull();
});

async function usdForm(rate: { usd: string; updatedAt: number }) {
  server.use(
    http.post(xrpc('resolveRecipient'), () => HttpResponse.json({ did: bob.did, handle: bob.handle, chainId: 1, address: payment.address })),
    http.get(xrpc('getEthPrice'), () => HttpResponse.json({ ...rate, source: 'test' })),
  );
  const rendered = await renderComponent(<PaymentTools />);
  await rendered.user.type(await screen.findByRole('combobox', { name: 'Recipient handle or DID' }), bob.handle);
  await rendered.user.click(screen.getByRole('button', { name: 'Resolve & review' }));
  await rendered.user.click(await screen.findByRole('button', { name: 'USD' }));
  return rendered;
}
it('creates an ETH intent from USD entry and previews the exact conversion', async () => {
  let body: any;
  server.use(http.post(xrpc('createPayment'), async ({ request }) => { body = await request.json(); return HttpResponse.json({ payment: { ...payment, amount: body.amount } }); }));
  const { user } = await usdForm({ usd: '2500', updatedAt: Date.now() });
  await user.type(screen.getByLabelText('Amount in USD'), '25');
  expect(await screen.findByText('You send 0.01 ETH ≈ $25.00 USD')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Create payment intent' }));
  await waitFor(() => expect(body).toMatchObject({ amount: '0.01', assetId: 'eip155:1/slip44:60' }));
});
it('blocks USD conversion when the rate is stale and clears amounts on currency switches', async () => {
  const { user } = await usdForm({ usd: '2500', updatedAt: Date.now() - 300001 });
  await user.type(screen.getByLabelText('Amount in USD'), '25');
  expect(screen.getByRole('button', { name: 'Create payment intent' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'ETH' }));
  expect(screen.getByLabelText('Amount in ETH')).toHaveValue('');
});
