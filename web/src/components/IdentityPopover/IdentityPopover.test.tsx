import { expect, it } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { IdentityPopover } from "./index";
it("only shows identity details on avatar click and dismisses with Escape", async () => {
  const { user } = await renderComponent(<IdentityPopover />);
  const avatar = await screen.findByRole("button", {
    name: "Account information",
  });
  expect(screen.queryByText("Your identity")).not.toBeInTheDocument();
  await user.click(avatar);
  expect(
    screen.getByRole("dialog", { name: "Account information" }),
  ).toBeInTheDocument();
  expect(await screen.findByText("@alice.test")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(avatar).toHaveFocus();
});
it("closes when clicking outside", async () => {
  const { user } = await renderComponent(
    <>
      <IdentityPopover />
      <button>Outside</button>
    </>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Account information" }),
  );
  await user.click(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
