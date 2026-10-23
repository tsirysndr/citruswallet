import { it, expect } from "vitest";
import { renderComponent, screen, waitFor } from "../../test/render";
import { HeaderNav, BottomNav } from "./Nav";
it.each([HeaderNav, BottomNav])(
  "navigates to the selected screen",
  async (Component) => {
    const { user, router } = await renderComponent(
      <Component marks={{ "/payments": true }} />,
    );
    await user.click(screen.getByRole("link", { name: "Activity" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/activity"),
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
  },
);
