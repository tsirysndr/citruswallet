import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { MetaMaskConnection } from "./MetaMaskConnection";
import { act } from "@testing-library/react";
it("only exposes a valid pending MetaMask request, and removes it when complete", async () => {
  await renderComponent(<MetaMaskConnection />);
  const send = (detail: string | null) =>
    act(() => {
      window.dispatchEvent(
        new CustomEvent("citrus:metamask-request", { detail }),
      );
    });
  send("https://evil.test");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  send("metamask://connect/mwp?p=test&c=1");
  expect(
    screen.getByRole("link", { name: "Open MetaMask again" }),
  ).toHaveAttribute("href", "metamask://connect/mwp?p=test&c=1");
  send(null);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
