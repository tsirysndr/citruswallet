import React, { useState } from "react";
import {
  screen,
  fireEventAsync as fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { renderComponent } from "../../../tests/render";
import { HandleInput } from "./HandleInput";
const alice = {
  did: "did:plc:alice",
  handle: "alice.test",
  displayName: "Alice",
  avatar: "https://example.com/alice.jpg",
};
function Input({ onSelect = () => {} }) {
  const [value, change] = useState("");
  return (
    <HandleInput
      value={value}
      onChange={change}
      onSelect={onSelect}
      excludeDid="did:plc:me"
    />
  );
}
beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      actors: [alice, { ...alice, did: "did:plc:me", handle: "me.test" }],
    }),
  }));
});
test("debounces suggestions, shows avatars and names, and excludes the sender", async () => {
  const select = jest.fn();
  renderComponent(<Input onSelect={select} />);
  await fireEvent(screen.getByLabelText("Handle"), "focus");
  await fireEvent.changeText(screen.getByLabelText("Handle"), "@alice");
  expect(fetch).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Use @alice.test" }),
    ).toBeTruthy(),
  );
  expect(screen.getByLabelText("Alice avatar")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Use @me.test" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Use @alice.test" }),
  );
  expect(select).toHaveBeenCalledWith(alice);
  expect(screen.getByLabelText("Handle").props.value).toBe("alice.test");
  expect(screen.queryByRole("button", { name: "Use @alice.test" })).toBeNull();
});
test("hides old suggestions immediately when the query changes", async () => {
  renderComponent(<Input />);
  await fireEvent(screen.getByLabelText("Handle"), "focus");
  await fireEvent.changeText(screen.getByLabelText("Handle"), "alice");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Use @alice.test" }),
    ).toBeTruthy(),
  );
  await fireEvent.changeText(screen.getByLabelText("Handle"), "bob");
  expect(screen.queryByRole("button", { name: "Use @alice.test" })).toBeNull();
});
test("keeps manual entry available when suggestions fail", async () => {
  fetch.mockRejectedValue(new Error("Offline"));
  renderComponent(<Input />);
  await fireEvent(screen.getByLabelText("Handle"), "focus");
  await fireEvent.changeText(screen.getByLabelText("Handle"), "alice.test");
  await waitFor(() =>
    expect(screen.getByText(/Suggestions are unavailable/)).toBeTruthy(),
  );
  expect(screen.getByLabelText("Handle").props.value).toBe("alice.test");
});
