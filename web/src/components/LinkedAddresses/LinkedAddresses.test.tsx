import { it, expect } from "vitest";
import { renderComponent, screen, waitFor } from "../../test/render";
import { LinkedAddresses } from "./LinkedAddresses";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
import { session, linkedAddress } from "../../test/mocks/fixtures";
it("shows linked addresses and sends an explicit default-address request", async () => {
  let received: unknown;
  server.use(
    http.get(xrpc("getSession"), () =>
      HttpResponse.json({ ...session, links: [linkedAddress] }),
    ),
    http.post(xrpc("setDefaultAddress"), async ({ request }) => {
      received = await request.json();
      return HttpResponse.json({ ok: true });
    }),
  );
  const { user } = await renderComponent(<LinkedAddresses />);
  await user.click(await screen.findByRole("button", { name: "Make default" }));
  await waitFor(() =>
    expect(received).toEqual({ address: linkedAddress.address }),
  );
});
