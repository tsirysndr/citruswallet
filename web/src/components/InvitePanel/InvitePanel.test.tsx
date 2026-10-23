import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { InvitePanel } from "./InvitePanel";
import { createStore } from "jotai";
import { inviteTokenAtom } from "../../atoms";
it("dismisses an invitation without accepting it", async () => {
  const store = createStore();
  store.set(inviteTokenAtom, "a".repeat(64));
  const { user } = await renderComponent(<InvitePanel />, { store });
  expect(
    await screen.findByRole("heading", { name: "Payment invitation" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(store.get(inviteTokenAtom)).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Payment invitation" }),
  ).not.toBeInTheDocument();
});
