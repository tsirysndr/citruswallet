import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { IdentityPanel } from "./IdentityPanel";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
import { signedOut } from "../../test/mocks/fixtures";
it("shows the profile returned by the API", async () => {
  await renderComponent(<IdentityPanel />);
  expect(await screen.findByText("Alice")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Sign in/ }),
  ).not.toBeInTheDocument();
});
it("validates an empty handle without starting OAuth", async () => {
  server.use(http.get(xrpc("getSession"), () => HttpResponse.json(signedOut)));
  const { user } = await renderComponent(<IdentityPanel />);
  await user.click(await screen.findByRole("button", { name: /Sign in/ }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});
