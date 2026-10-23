import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { PaymentTools } from "./PaymentTools";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
import { alice, session } from "../../test/mocks/fixtures";
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
