import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { InstallMetaMask } from "./InstallMetaMask";
import { vi } from "vitest";
import { metamaskChromeUrl, metamaskFirefoxUrl } from "../../metamask";
it.each([
  ["Mozilla/5.0 Firefox/145.0", metamaskFirefoxUrl],
  ["Mozilla/5.0 Chrome/140.0 Safari/537.36", metamaskChromeUrl],
])("chooses the browser's extension store: %s", async (ua, url) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  await renderComponent(<InstallMetaMask />);
  expect(
    screen.getByRole("link", { name: "Install MetaMask" }),
  ).toHaveAttribute("href", url);
});
it("hides installation when an injected MetaMask provider exists", async () => {
  window.ethereum = { isMetaMask: true, request: vi.fn() };
  await renderComponent(<InstallMetaMask />);
  expect(
    screen.queryByRole("link", { name: "Install MetaMask" }),
  ).not.toBeInTheDocument();
});
it("offers the app connection on Android instead of an extension store", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Android Chrome/140.0",
  );
  await renderComponent(<InstallMetaMask />);
  expect(
    screen.getByRole("button", { name: "Connect MetaMask" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Install MetaMask" }),
  ).not.toBeInTheDocument();
});
