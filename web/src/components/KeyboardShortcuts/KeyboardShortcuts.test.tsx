import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { vi } from "vitest";
it("opens quick search with slash, but not while typing", async () => {
  const open = vi.fn();
  window.addEventListener("citrus:activity-search", open);
  try {
    const { user } = await renderComponent(
      <>
        <KeyboardShortcuts />
        <input aria-label="Message" />
      </>,
    );
    await user.keyboard("/");
    expect(open).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("textbox", { name: "Message" }));
    await user.type(screen.getByRole("textbox"), "/");
    expect(open).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Keyboard shortcuts" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
  } finally {
    window.removeEventListener("citrus:activity-search", open);
  }
});
it("omits shortcut controls on mobile", async () => {
  vi.mocked(window.matchMedia).mockReturnValue({
    ...window.matchMedia(""),
    matches: false,
  });
  await renderComponent(<KeyboardShortcuts />);
  expect(
    screen.queryByRole("button", { name: "Keyboard shortcuts" }),
  ).not.toBeInTheDocument();
});

it("respects the opt-out preference", async () => {
  localStorage.setItem("citrus-keyboard-shortcuts", "off");
  const open = vi.fn();
  window.addEventListener("citrus:activity-search", open);
  try {
    const { user } = await renderComponent(<KeyboardShortcuts />);
    await user.keyboard("/");
    expect(open).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Keyboard shortcuts" }),
    );
    expect(
      screen.getByRole("checkbox", {
        name: "Enable navigation and search shortcuts",
      }),
    ).not.toBeChecked();
  } finally {
    window.removeEventListener("citrus:activity-search", open);
  }
});
