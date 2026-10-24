import React from "react";
import {
  screen,
  fireEventAsync as fireEvent,
} from "@testing-library/react-native";
import { renderComponent } from "../../../tests/render";
import { IdentitySheet } from "./index";
import { request, saveToken } from "../../api";
jest.mock("../../hooks", () => ({
  useSession: () => ({ data: { did: "did:plc:alice" } }),
  useProfile: () => ({
    data: { did: "did:plc:alice", handle: "alice.test", displayName: "Alice" },
  }),
  useAction: () => (fn) => fn(),
}));
jest.mock("../../api", () => ({
  request: jest.fn(async () => ({})),
  saveToken: jest.fn(async () => {}),
}));
test("avatar opens identity in a dismissible bottom sheet", async () => {
  renderComponent(<IdentitySheet />);
  expect(screen.queryByText("Your identity")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Account information" }),
  );
  expect(screen.getByText("@alice.test")).toBeTruthy();
  expect(screen.getByText("did:plc:alice")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Close account information" }),
  );
  expect(screen.queryByText("Your identity")).toBeNull();
});
test("sign out clears the session and closes the sheet", async () => {
  renderComponent(<IdentitySheet />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Account information" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
  expect(request).toHaveBeenCalledWith("logout", {});
  expect(saveToken).toHaveBeenCalledWith(null);
  expect(screen.queryByText("Your identity")).toBeNull();
});
