import { expect, it } from "vitest";
import { http, HttpResponse } from "msw/http";
import { server } from "../../test/mocks/server";
import { xrpc } from "../../test/mocks/handlers";
import { renderComponent, screen, waitFor } from "../../test/render";
import { Notifications } from "./Notifications";
it("opens a received payment and marks its notification read", async () => {
  let read = false;
  server.use(
    http.get(xrpc("listNotifications"), () =>
      HttpResponse.json({
        notifications: [
          { id: "1", paymentId: "received", createdAt: "1790000000000", read },
        ],
        unread: read ? 0 : 1,
      }),
    ),
    http.post(xrpc("markNotificationRead"), async ({ request }) => {
      expect(await request.json()).toEqual({ id: "1" });
      read = true;
      return HttpResponse.json({ ok: true });
    }),
  );
  const { user, router } = await renderComponent(<Notifications />);
  await user.click(
    await screen.findByRole(
      "button",
      { name: "Notifications, 1 unread" },
      { timeout: 10000 },
    ),
  );
  expect(
    screen.getByText("1", { selector: ".notification-count" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Payment received/ }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/payments"));
  expect(read).toBe(true);
});

it("opens a non-modal popover, clears all unread notifications and dismisses on Escape", async () => {
  let unread = 120;
  server.use(
    http.get(xrpc("listNotifications"), () =>
      HttpResponse.json({ notifications: [], unread }),
    ),
    http.post(xrpc("markAllNotificationsRead"), () => {
      unread = 0;
      return HttpResponse.json({ ok: true });
    }),
  );
  const { user } = await renderComponent(<Notifications />);
  const bell = await screen.findByRole(
    "button",
    { name: "Notifications, 120 unread" },
    { timeout: 10000 },
  );
  expect(screen.getByText("99+")).toBeInTheDocument();
  await user.click(bell);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Payment notifications" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Mark all as read" }));
  await waitFor(
    () => expect(screen.queryByText("99+")).not.toBeInTheDocument(),
    { timeout: 5000 },
  );
  expect(
    screen.getByRole("button", { name: "Mark all as read" }),
  ).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(
    screen.queryByRole("region", { name: "Payment notifications" }),
  ).not.toBeInTheDocument();
  expect(bell).toHaveFocus();
}, 20000);
