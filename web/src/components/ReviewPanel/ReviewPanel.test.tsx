import { it, expect } from "vitest";
import { renderComponent, screen, waitFor } from "../../test/render";
import { ReviewPanel } from "./ReviewPanel";
import { createStore } from "jotai";
import { reviewIdAtom } from "../../atoms";
import { payment } from "../../test/mocks/fixtures";
it("requires acknowledgement before enabling MetaMask payment approval", async () => {
  const store = createStore();
  store.set(reviewIdAtom, payment.id);
  const { user } = await renderComponent(<ReviewPanel />, { store });
  const send = await screen.findByRole("button", {
    name: "Review & send",
  });
  expect(send).toBeDisabled();
  await user.click(screen.getByRole("checkbox"));
  expect(send).toBeEnabled();
  expect(screen.getByText("Dinner with friends")).toBeInTheDocument();
});

import { vi } from "vitest";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
import { statusAtom } from "../../atoms";
const wallet = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../wallet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wallet")>()),
  connectWallet: async () => wallet,
  walletAccount: async () => "0x2222222222222222222222222222222222222222",
}));
it("never sends a transaction when preparation changes the reviewed recipient address", async () => {
  server.use(
    http.post(xrpc("preparePayment"), () =>
      HttpResponse.json({
        payment,
        attemptId: "attempt-1",
        transaction: {
          from: "0x2222222222222222222222222222222222222222",
          to: "0x3333333333333333333333333333333333333333",
          value: "0x2386f26fc10000",
          chainId: "0x1",
          data: "0x",
          nonce: "0x0",
        },
      }),
    ),
  );
  const store = createStore();
  store.set(reviewIdAtom, payment.id);
  const { user } = await renderComponent(<ReviewPanel />, { store });
  await screen.findByRole("checkbox");
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Review & send" }),
  );
  await waitFor(() =>
    expect(store.get(statusAtom).message).toMatch(/differs from your review/),
  );
  expect(wallet.request).not.toHaveBeenCalled();
});
