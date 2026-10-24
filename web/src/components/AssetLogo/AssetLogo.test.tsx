import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { AssetLogo } from "./index";
import { nativeAsset } from "../../assets";
import { tokenLogo } from "../../token-logos";
it("renders circular logos and falls back if an image fails", () => {
  const { container } = render(<AssetLogo asset={nativeAsset(6343)} />);
  const image = container.querySelector("img")!;
  expect(image).toBeTruthy();
  expect(image.parentElement).toHaveClass("rounded-full");
  fireEvent.error(image);
  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent("ET");
});
it("never picks a known logo by symbol alone or on another chain", () => {
  const asset = {
    ...nativeAsset(1),
    kind: "erc20" as const,
    symbol: "USDC",
    contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  };
  expect(tokenLogo(asset)).toMatch(/^https:/);
  expect(tokenLogo({ ...asset, chainId: 6343 })).toBeUndefined();
  expect(
    tokenLogo({
      ...asset,
      contractAddress: "0x1111111111111111111111111111111111111111",
    }),
  ).toBeUndefined();
});
