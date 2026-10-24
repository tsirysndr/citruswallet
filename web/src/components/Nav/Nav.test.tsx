import { http, HttpResponse } from "msw/http";
import { server } from "../../test/mocks/server";
import { xrpc } from "../../test/mocks/handlers";
import { alice, session, signedOut } from "../../test/mocks/fixtures";
import { it, expect, vi } from "vitest";
import { renderComponent, screen, waitFor, within } from "../../test/render";
import { SidebarNav, BottomNav } from "./Nav";

it.each([false, true])(
  "sidebar navigates when collapsed=%s",
  async (collapsed) => {
    const onToggle = vi.fn();
    const { user, router } = await renderComponent(
      <SidebarNav
        marks={{ "/payments": true }}
        collapsed={collapsed}
        onToggle={onToggle}
        network="Ethereum"
      />,
    );
    await user.click(screen.getByRole("link", { name: "Activity" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/activity"),
    );
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(screen.getByRole("navigation")).getAllByRole("link"),
    ).toHaveLength(4);
    const toggle = screen.getByRole("button", {
      name: collapsed ? "Expand sidebar" : "Collapse sidebar",
    });
    expect(toggle).toHaveAttribute("aria-expanded", String(!collapsed));
    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  },
);

it("keeps bottom tab navigation", async () => {
  const { user, router } = await renderComponent(<BottomNav marks={{}} />);
  await user.click(screen.getByRole("link", { name: "Activity" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/activity"));
  expect(screen.getAllByRole("link")).toHaveLength(4);
});

it.each([false, true])(
  "shows the connected account and signs out when collapsed=%s",
  async (collapsed) => {
    let current = session;
    server.use(
      http.get(xrpc("getSession"), () => HttpResponse.json(current)),
      http.get(xrpc("getProfile"), () =>
        HttpResponse.json({ actor: { ...alice, avatar: "/avatar.jpg" } }),
      ),
      http.post(xrpc("logout"), () => {
        current = signedOut;
        return HttpResponse.json({ ok: true });
      }),
    );
    const { user } = await renderComponent(
      <SidebarNav
        marks={{}}
        collapsed={collapsed}
        onToggle={() => {}}
        network="Ethereum"
      />,
    );
    const profile = await screen.findByRole("button", {
      name: "Your account: Alice",
    });
    expect(profile.querySelector("img")).toHaveAttribute("src", "/avatar.jpg");
    if (!collapsed) expect(screen.getByText("@alice.test")).toBeInTheDocument();
    else expect(profile).toHaveAttribute("title", "Alice (@alice.test)");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Connected account" }),
      ).not.toBeInTheDocument(),
    );
  },
);

it("does not show account actions while signed out", async () => {
  server.use(http.get(xrpc("getSession"), () => HttpResponse.json(signedOut)));
  const { client } = await renderComponent(
    <SidebarNav
      marks={{}}
      collapsed={false}
      onToggle={() => {}}
      network="Ethereum"
    />,
  );
  await waitFor(() =>
    expect(client.getQueryData(["session"])).toEqual(signedOut),
  );
  expect(
    screen.queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
});
