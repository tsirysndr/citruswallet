import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import AtmosphereApps from "./AtmosphereApps";
it("lets users pause and resume the app animation", async () => {
  const { user } = await renderComponent(<AtmosphereApps />);
  expect(
    screen.getByRole("img", { name: /Apps in the Atmosphere: Bluesky/ }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Pause app animation" }));
  expect(
    screen.getByRole("button", { name: "Play app animation" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Play app animation" }));
  expect(
    screen.getByRole("button", { name: "Pause app animation" }),
  ).toBeInTheDocument();
});
