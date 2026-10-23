import { it, expect, vi } from "vitest";
import { renderComponent, screen, waitFor, within } from "../../test/render";
import { SidebarNav, BottomNav } from "./Nav";

it.each([false, true])("sidebar navigates when collapsed=%s", async collapsed => {
  const onToggle = vi.fn();
  const { user, router } = await renderComponent(
    <SidebarNav marks={{ "/payments": true }} collapsed={collapsed} onToggle={onToggle} network="Ethereum" />,
  );
  await user.click(screen.getByRole("link", { name: "Activity" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/activity"));
  expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute("aria-current", "page");
  expect(within(screen.getByRole("navigation")).getAllByRole("link")).toHaveLength(4);
  const toggle = screen.getByRole("button", { name: collapsed ? "Expand sidebar" : "Collapse sidebar" });
  expect(toggle).toHaveAttribute("aria-expanded", String(!collapsed));
  await user.click(toggle);
  expect(onToggle).toHaveBeenCalledOnce();
});

it("keeps bottom tab navigation", async () => {
  const { user, router } = await renderComponent(<BottomNav marks={{}} />);
  await user.click(screen.getByRole("link", { name: "Activity" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/activity"));
  expect(screen.getAllByRole("link")).toHaveLength(4);
});
