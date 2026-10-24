import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Avatar } from "./Avatar";
test("shows the profile image with a name, and a readable fallback without an image", () => {
  const { rerender } = render(
    <Avatar
      actor={{
        displayName: "Alice",
        handle: "alice.test",
        avatar: "https://example.com/avatar.jpg",
      }}
    />,
  );
  expect(screen.getByLabelText("Alice avatar")).toBeTruthy();
  rerender(
    <Avatar
      actor={{ displayName: "Alice", handle: "alice.test", avatar: null }}
    />,
  );
  expect(screen.getByText("A")).toBeTruthy();
  rerender(<Avatar />);
  expect(screen.getByText("@")).toBeTruthy();
});
