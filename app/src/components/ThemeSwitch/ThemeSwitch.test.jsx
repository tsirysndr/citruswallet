import React from "react";
import {
  render,
  screen,
  fireEventAsync as fireEvent,
} from "@testing-library/react-native";
import { ThemeSwitch } from "./ThemeSwitch";
test("announces checked state, toggles and respects disabled state", async () => {
  const change = jest.fn();
  const { rerender } = render(
    <ThemeSwitch
      accessibilityLabel="Public address"
      value={false}
      onValueChange={change}
    />,
  );
  await fireEvent.press(screen.getByRole("switch", { name: "Public address" }));
  expect(change).toHaveBeenCalledWith(true);
  rerender(
    <ThemeSwitch
      accessibilityLabel="Public address"
      value
      onValueChange={change}
      disabled
    />,
  );
  expect(screen.getByRole("switch")).toBeChecked();
  await fireEvent.press(screen.getByRole("switch"));
  expect(change).toHaveBeenCalledTimes(1);
});
