import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { InstallApp } from "./InstallApp";
it("shows and dismisses manual PWA install instructions", async () => {
  const { user } = await renderComponent(<InstallApp />);
  await user.click(screen.getByRole("button", { name: "Install app" }));
  expect(
    screen.getByRole("dialog", { name: "Keep Citrus close." }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Add to Home Screen/, { selector: "p.mt-4" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Got it" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
