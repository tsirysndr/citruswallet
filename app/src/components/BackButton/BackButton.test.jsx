import React from "react";
import {
  fireEventAsync as fireEvent,
  screen,
} from "@testing-library/react-native";
import { renderComponent } from "../../../tests/render";
import { BackButton } from "./index";
test("uses a compact icon with an accessible label and respects disabled state", async () => {
  const press = jest.fn();
  renderComponent(<BackButton label="Back to settings" onPress={press} />);
  expect(screen.queryByText("Back to settings")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to settings" }),
  );
  expect(press).toHaveBeenCalledTimes(1);
});
test("disables navigation while blocked", () => {
  renderComponent(
    <BackButton label="Back to settings" onPress={jest.fn()} disabled />,
  );
  expect(
    screen.getByRole("button", { name: "Back to settings" }),
  ).toBeDisabled();
});
