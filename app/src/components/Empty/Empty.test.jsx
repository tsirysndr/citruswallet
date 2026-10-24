import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Empty } from "./Empty";
test("explains the empty state to the user", () => {
  render(<Empty text="No linked wallets yet." />);
  expect(screen.getByText("No linked wallets yet.")).toBeTruthy();
});
