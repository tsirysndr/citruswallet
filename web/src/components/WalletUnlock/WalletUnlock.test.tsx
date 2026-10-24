import { expect, it, afterEach } from "vitest";
import { createStore } from "jotai";
import { renderComponent, screen } from "../../test/render";
import { busyAtom } from "../../atoms";
import { unlockSnapshot } from "../../wallet-unlock";
import { lockLocalWallet } from "../../local-wallet";
import { WalletUnlock } from "./index";
afterEach(() => lockLocalWallet());
it("does not disable unlock or cancellation while a payment awaits the wallet", async () => {
  localStorage.setItem("citrus:encrypted-wallet:v1", "{}");
  const store = createStore();
  store.set(busyAtom, true);
  const { user } = await renderComponent(<WalletUnlock />, { store });
  expect(
    screen.getByRole("dialog", { name: "Unlock Peachlet wallet" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Unlock wallet" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Cancel" }).parentElement).toBe(
    screen.getByRole("button", { name: "Unlock wallet" }).parentElement,
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(unlockSnapshot()).toBe(false);
  expect(
    screen.queryByRole("dialog", { name: "Unlock Peachlet wallet" }),
  ).not.toBeInTheDocument();
});

it("does not automatically prompt for the local wallet when MetaMask is selected", async () => {
  localStorage.setItem("citrus:encrypted-wallet:v1", "{}");
  localStorage.setItem("citrus:wallet-mode", "metamask");
  await renderComponent(<WalletUnlock />);
  expect(unlockSnapshot()).toBe(false);
  expect(
    screen.queryByRole("dialog", { name: "Unlock Peachlet wallet" }),
  ).not.toBeInTheDocument();
});
it("shares the same unlock request between automatic unlock and a wallet action", async () => {
  const { requestUnlock, finishUnlock } = await import("../../wallet-unlock");
  const automatic = requestUnlock(),
    payment = requestUnlock();
  expect(payment).toBe(automatic);
  finishUnlock(true);
  await expect(payment).resolves.toBeUndefined();
});
