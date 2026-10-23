import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { PageHeading } from "./PageHeading";
it("exposes the page title and supporting description", async () => {
  await renderComponent(
    <PageHeading title="Your wallet" description="Manage your addresses" />,
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "Your wallet" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Manage your addresses")).toBeInTheDocument();
});
