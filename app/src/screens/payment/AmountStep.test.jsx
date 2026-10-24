import React from "react";
import { screen } from "@testing-library/react-native";
import { renderComponent } from "../../../tests/render";
import { AmountStep } from "./AmountStep";
test("shows the recipient display name and handle without a note field on the amount screen", () => {
  renderComponent(
    <AmountStep
      actor={{ displayName: "Alice", handle: "alice.test", avatar: null }}
      handle="alice.test"
      amount="1"
      onAmount={() => {}}
      onContinue={() => {}}
    />,
  );
  expect(screen.getByText("Sending to")).toBeTruthy();
  expect(screen.getByText("Alice")).toBeTruthy();
  expect(screen.getByText("@alice.test")).toBeTruthy();
  expect(screen.queryByLabelText("Description (optional)")).toBeNull();
});
test("validates token precision before continuing", () => {
  const props = {
    actor: null,
    handle: "alice.test",
    onAmount: () => {},
    onContinue: () => {},
    decimals: 6,
    symbol: "USDC",
  };
  const result = renderComponent(<AmountStep {...props} amount="1.0000001" />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  result.unmount();
  renderComponent(<AmountStep {...props} amount="1.000001" />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  expect(screen.getByLabelText("Amount 1.000001 USDC")).toBeTruthy();
});
