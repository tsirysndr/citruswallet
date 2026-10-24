import React from "react";
import { AccessibilityInfo } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import ContentLoader from "react-content-loader/native";
import { ContentSkeleton } from "./ContentSkeleton";
afterEach(() => jest.restoreAllMocks());
test("provides an accessible label and animates when motion is allowed", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
  render(<ContentSkeleton label="Loading payments" />);
  expect(
    screen.getByRole("progressbar", { name: "Loading payments" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(screen.UNSAFE_getByType(ContentLoader).props.animate).toBe(true),
  );
});
test("respects reduced motion while keeping the content placeholder visible", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
  render(<ContentSkeleton variant="media" label="Loading media" />);
  await waitFor(() =>
    expect(screen.UNSAFE_getByType(ContentLoader).props.animate).toBe(false),
  );
  expect(
    screen.getByRole("progressbar", { name: "Loading media" }),
  ).toBeTruthy();
});
