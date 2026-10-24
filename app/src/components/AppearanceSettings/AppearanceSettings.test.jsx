import React from "react";
import {
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderComponent } from "../../../tests/render";
import { ThemeProvider, useTheme } from "../../theme";
import { Text } from "../Typography";
import { AppearanceSettings } from "./index";
function Preview() {
  const { colors } = useTheme();
  return <Text testID="canvas">{colors.canvas}</Text>;
}
function mount() {
  return renderComponent(
    <ThemeProvider>
      <AppearanceSettings />
      <Preview />
    </ThemeProvider>,
  );
}
beforeEach(() => AsyncStorage.clear());
test("persists dark appearance and restores it after remounting", async () => {
  const view = mount();
  const toggle = await screen.findByRole("switch", { name: "Dark appearance" });
  fireEvent.press(toggle);
  await waitFor(() =>
    expect(screen.getByTestId("canvas").props.children).toBe("#000000"),
  );
  expect(await AsyncStorage.getItem("peachlet-appearance")).toBe("dark");
  view.unmount();
  mount();
  expect(await screen.findByText("#000000")).toBeTruthy();
  expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
    true,
  );
  fireEvent.press(screen.getByRole("switch"));
  await waitFor(() =>
    expect(screen.getByTestId("canvas").props.children).toBe("#f7f3f0"),
  );
  expect(await AsyncStorage.getItem("peachlet-appearance")).toBe("light");
});
test("ignores invalid stored appearance", async () => {
  await AsyncStorage.setItem("peachlet-appearance", "invalid");
  mount();
  expect(await screen.findByText("#f7f3f0")).toBeTruthy();
});
