import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AssetLogo } from "./index";
test("unknown tokens get a circular symbol fallback", () => {
  render(
    <AssetLogo
      asset={{
        chainId: 6343,
        kind: "erc20",
        contractAddress: "0x1111111111111111111111111111111111111111",
        symbol: "TEST",
      }}
    />,
  );
  expect(screen.getByText("TE")).toBeTruthy();
});
