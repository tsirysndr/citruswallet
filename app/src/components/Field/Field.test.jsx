import React from "react";
import {
  render,
  screen,
  fireEventAsync as fireEvent,
} from "@testing-library/react-native";
import { Field } from "./Field";
test("labels the editable field and forwards user input", async () => {
  const change = jest.fn();
  render(
    <Field label="Description" value="" onChangeText={change} multiline />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Description"),
    "Thanks for lunch",
  );
  expect(change).toHaveBeenCalledWith("Thanks for lunch");
});

test("secret fields retain their value when toggled and forward keyboard submission", async () => {
  const submit = jest.fn();
  render(
    <Field
      label="Private key"
      value="test-secret"
      secureTextEntry
      onSubmitEditing={submit}
    />,
  );
  const input = screen.getByLabelText("Private key");
  expect(input.props.secureTextEntry).toBe(true);
  await fireEvent.press(
    screen.getByRole("button", { name: "Show private key" }),
  );
  expect(screen.getByLabelText("Private key").props.secureTextEntry).toBe(
    false,
  );
  expect(screen.getByLabelText("Private key").props.value).toBe("test-secret");
  expect(submit).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Hide private key" }),
  );
  expect(screen.getByLabelText("Private key").props.secureTextEntry).toBe(true);
  await fireEvent(screen.getByLabelText("Private key"), "submitEditing");
  expect(submit).toHaveBeenCalledTimes(1);
});
