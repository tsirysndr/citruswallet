import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { Avatar } from "./Avatar";
import { bob } from "../../test/mocks/fixtures";
import { fireEvent } from "@testing-library/react";
it("falls back to initials when an avatar fails", async () => {
  const { container } = await renderComponent(<Avatar actor={bob} />);
  fireEvent.error(container.querySelector("img")!);
  expect(screen.getByText("B")).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});
