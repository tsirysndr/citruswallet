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
    await screen.findByRole("button", { name: "Notifications, 1 unread" }),
  );
  await user.click(screen.getByRole("button", { name: /Payment received/ }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/payments"));
  expect(read).toBe(true);
});
