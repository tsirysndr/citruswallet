import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { WalletPanel } from "./WalletPanel";
import { vi } from "vitest";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
import { signedOut } from "../../test/mocks/fixtures";
it("requires sign-in before requesting a linking signature", async () => {
  const request = vi.fn();
  window.ethereum = { isMetaMask: true, request };
  server.use(http.get(xrpc("getSession"), () => HttpResponse.json(signedOut)));
  await renderComponent(<WalletPanel />);
  expect(
    await screen.findByRole("button", { name: "Connect MetaMask & link" }),
  ).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
});
it("uses Firefox installation in the wallet card", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Firefox/145.0");
  await renderComponent(<WalletPanel />);
  expect(
    screen.getByRole("link", { name: /Install MetaMask/ }),
  ).toHaveAttribute(
    "href",
    "https://addons.mozilla.org/en-US/firefox/addon/ether-metamask",
  );
});
