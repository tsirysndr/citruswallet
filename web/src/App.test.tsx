import { expect, it } from "vitest";
import { App } from "./App";
import { renderComponent, screen, waitFor, act } from "./test/render";
import { server } from "./test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "./test/mocks/handlers";
import { session, signedOut, linkedAddress } from "./test/mocks/fixtures";

it("only mounts activity search for signed-in users and closes it when the session ends", async () => {
  const configured = { ...session, links: [{ ...linkedAddress, is_default: true }] };
  let current = { ...signedOut, links: configured.links };
  server.use(http.get(xrpc("getSession"), () => HttpResponse.json(current)));
  const { client, user } = await renderComponent(<App />);
  await waitFor(() =>
    expect(client.getQueryData(["session"])).toEqual(current),
  );
  expect(
    screen.queryByRole("button", { name: "Search activity" }),
  ).not.toBeInTheDocument();
  await user.keyboard("/");
  expect(
    screen.queryByRole("dialog", { name: "Search activity" }),
  ).not.toBeInTheDocument();
  current = configured;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["session"] });
  });
  await user.click(
    await screen.findByRole("button", { name: "Search activity" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Search activity" }),
  ).toBeInTheDocument();
  current = signedOut;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["session"] });
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Search activity" }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("button", { name: "Search activity" }),
  ).not.toBeInTheDocument();
});

it("collapses the desktop sidebar and remembers the preference", async () => {
  server.use(http.get(xrpc("getSession"), () => HttpResponse.json({ ...session, links: [{ ...linkedAddress, is_default: true }] })));
  const { user, unmount } = await renderComponent(<App />);
  await user.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
  expect(document.querySelector(".app-shell")).toHaveClass("sidebar-collapsed");
  expect(localStorage.getItem("citrus:sidebar-collapsed")).toBe("true");
  unmount();
  const next = await renderComponent(<App />);
  expect(await screen.findByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  await next.user.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(document.querySelector(".app-shell")).not.toHaveClass("sidebar-collapsed");
});

it("requires full-screen wallet setup when no wallet is configured", async () => {
  await renderComponent(<App />);
  expect(await screen.findByRole('button', { name: /Create a Peachlet wallet/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Search activity' })).not.toBeInTheDocument();
});
