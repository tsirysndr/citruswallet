import { it, expect } from "vitest";
import { renderComponent, screen, waitFor } from "../../test/render";
import { ActivitySearch } from "./ActivitySearch";
import { reviewIdAtom } from "../../atoms";
it("filters activity through XRPC and opens the selected payment with Enter", async () => {
  const { user, store, router } = await renderComponent(<ActivitySearch />);
  await user.click(screen.getByRole("button", { name: "Search activity" }));
  const input = screen.getByRole("combobox", { name: "Search your activity" });
  await user.type(input, "Dinner");
  expect(
    await screen.findByRole("option", { name: /Dinner with friends/ }),
  ).toBeInTheDocument();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(router.state.location.pathname).toBe("/payments"));
  expect(store.get(reviewIdAtom)).toBe("payment-1");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("shows an empty state for an unmatched query", async () => {
  const { user } = await renderComponent(<ActivitySearch />);
  await user.click(screen.getByRole("button", { name: "Search activity" }));
  await user.type(screen.getByRole("combobox"), "nonexistent");
  expect(await screen.findByText(/No payments found/)).toBeInTheDocument();
});

it("does not show a stale result when the search changes", async () => {
  const { user } = await renderComponent(<ActivitySearch />);
  await user.click(screen.getByRole("button", { name: "Search activity" }));
  expect(
    await screen.findByRole("option", { name: /Dinner with friends/ }),
  ).toBeInTheDocument();
  await user.type(screen.getByRole("combobox"), "missing");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(await screen.findByText(/No payments found/)).toBeInTheDocument();
});
