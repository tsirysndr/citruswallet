import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { ThemeToggle } from "./ThemeToggle";
import { vi } from "vitest";
const theme = vi.hoisted(() => ({
  current: () => "light",
  set: vi.fn(),
  subscribe: () => () => {},
}));
vi.mock("../../theme", () => ({ theme }));
it("requests the opposite theme", async () => {
  const { user } = await renderComponent(<ThemeToggle />);
  await user.click(
    screen.getByRole("button", { name: "Switch to the dark theme" }),
  );
  expect(theme.set).toHaveBeenCalledWith("dark");
});
