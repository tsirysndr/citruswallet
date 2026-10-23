import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { PaymentMedia } from "./PaymentMedia";
import { fireEvent } from "@testing-library/react";
import { media } from "../../test/mocks/fixtures";
it("rejects unsafe attachment URLs", async () => {
  const { container } = await renderComponent(
    <PaymentMedia media={{ ...media, url: "https://evil.test/image.gif" }} />,
  );
  expect(container.querySelector("figure")).toBeNull();
});
it("shows a fallback when an allowed attachment fails", async () => {
  await renderComponent(<PaymentMedia media={media} />);
  fireEvent.error(screen.getByRole("img", { name: "Thank you" }));
  expect(
    screen.getByText(/attachment is no longer available/),
  ).toBeInTheDocument();
});
