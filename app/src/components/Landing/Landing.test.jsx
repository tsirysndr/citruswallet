import React from "react";
import { Linking } from "react-native";
import {
  screen,
  fireEventAsync as fireEvent,
} from "@testing-library/react-native";
import { renderComponent } from "../../../tests/render";
import { Landing } from "./index";

test("opens wallet entry only when Get started is pressed", async () => {
  const start = jest.fn();
  renderComponent(<Landing onGetStarted={start} />);
  expect(screen.getByRole("header", { name: /Send ETH/ })).toBeTruthy();
  expect(start).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Get started" }));
  expect(start).toHaveBeenCalledTimes(1);
});

test("opens the public privacy policy", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  renderComponent(<Landing onGetStarted={() => {}} />);
  await fireEvent.press(screen.getByRole("link", { name: "Privacy" }));
  expect(open).toHaveBeenCalledWith("https://peachlet.app/privacy");
  open.mockRestore();
});
