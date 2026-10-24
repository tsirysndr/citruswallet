import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw/http";
import { server } from "../../test/mocks/server";
import { xrpc } from "../../test/mocks/handlers";
import { renderComponent, screen, waitFor } from "../../test/render";
import { WebPushSettings } from "./WebPushSettings";
function browser(permission: NotificationPermission = "granted") {
  const requestPermission = vi.fn().mockResolvedValue(permission);
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const subscription = {
    endpoint: "https://fcm.googleapis.com/test",
    options: {},
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/test",
      keys: { p256dh: "public-key", auth: "auth-key" },
    }),
    unsubscribe,
  };
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  };
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("Notification", { permission: "default", requestPermission });
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
  return { requestPermission, unsubscribe, pushManager, subscription };
}
it("only requests permission on click, registers and disables a browser subscription", async () => {
  const b = browser();
  let saved = false,
    removed = false;
  server.use(
    http.get(xrpc("getWebPushConfig"), () =>
      HttpResponse.json({ publicKey: "BA" }),
    ),
    http.post(xrpc("registerWebPush"), async ({ request }) => {
      expect(await request.json()).toEqual({
        endpoint: b.subscription.endpoint,
        p256dh: "public-key",
        auth: "auth-key",
      });
      saved = true;
      return HttpResponse.json({ ok: true });
    }),
    http.post(xrpc("unregisterWebPush"), () => {
      removed = true;
      return HttpResponse.json({ ok: true });
    }),
  );
  try {
    const { user } = await renderComponent(
      <WebPushSettings did="did:plc:bob" />,
    );
    expect(b.requestPermission).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Enable browser notifications" }),
    );
    await screen.findByRole("button", {
      name: "Disable browser notifications",
    });
    expect(saved).toBe(true);
    expect(b.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    b.pushManager.getSubscription.mockResolvedValue(b.subscription as never);
    await user.click(
      screen.getByRole("button", { name: "Disable browser notifications" }),
    );
    await waitFor(() => expect(removed).toBe(true));
    expect(b.unsubscribe).toHaveBeenCalled();
  } finally {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  }
});
it("permission denial never creates or registers a subscription", async () => {
  const b = browser("denied");
  try {
    const { user } = await renderComponent(
      <WebPushSettings did="did:plc:bob" />,
    );
    await user.click(
      screen.getByRole("button", { name: "Enable browser notifications" }),
    );
    expect(
      await screen.findByText(/Notifications are blocked/),
    ).toBeInTheDocument();
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
  } finally {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  }
});
