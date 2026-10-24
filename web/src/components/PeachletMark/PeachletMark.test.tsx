import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { PeachletMark } from "./PeachletMark";
it("renders a decorative scalable mark without adding an accessible image", async () => {
  const { container } = await renderComponent(
    <PeachletMark className="brand-mark" />,
  );
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector("svg")).toHaveAttribute(
    "viewBox",
    "0 0 48 48",
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
