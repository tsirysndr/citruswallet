import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { SignedOut } from "./SignedOut";
it("offers a sign-in route with contextual guidance", async () => {
  await renderComponent(<SignedOut>Sign in to see your activity.</SignedOut>);
  expect(screen.getByText("Sign in to see your activity.")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Sign in to get started/ }),
  ).toHaveAttribute("href", "/");
});
