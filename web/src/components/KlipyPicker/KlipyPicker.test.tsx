import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { KlipyPicker } from "./KlipyPicker";
import { vi } from "vitest";
it("loads mocked media and returns the selected attachment", async () => {
  const change = vi.fn();
  const { user } = await renderComponent(
    <KlipyPicker value={null} onChange={change}><textarea aria-label="Description" defaultValue="Dinner" /></KlipyPicker>,
  );
  const trigger = screen.getByRole("button", { name: "Add GIF, sticker, meme or clip" });
  expect(trigger).toHaveTextContent(/^$/);
  expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Dinner");
  await user.click(trigger);
  await user.click(
    await screen.findByRole("button", { name: "Attach Thank you" }),
  );
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({ slug: "thanks", kind: "gifs" }),
    "",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
