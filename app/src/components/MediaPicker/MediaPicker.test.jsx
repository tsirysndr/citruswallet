import React, { useState } from "react";
import {
  screen,
  fireEventAsync as fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { renderComponent } from "../../../tests/render";
import { MediaPicker } from "./MediaPicker";
import { fetchMedia } from "../../klipy";
jest.mock("../../klipy", () => ({
  klipyEnabled: true,
  fetchMedia: jest.fn(),
  mediaKinds: [
    { value: "gifs", label: "GIFs" },
    { value: "static-memes", label: "Memes" },
  ],
}));
const media = {
  kind: "gifs",
  slug: "party",
  preview: "https://static.klipy.com/party.gif",
  url: "https://static.klipy.com/party.gif",
  title: "Party",
};
function Picker({ onChange }) {
  const [value, setValue] = useState(null);
  return (
    <MediaPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}
beforeEach(() => {
  fetchMedia.mockReset();
  fetchMedia.mockResolvedValue({ items: [{ media }], hasNext: false });
});
test("attaches a selected GIF, closes the picker and allows removal", async () => {
  const change = jest.fn();
  renderComponent(<Picker onChange={change} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Add GIF, sticker, meme or clip" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Attach Party" })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Attach Party" }));
  expect(change).toHaveBeenLastCalledWith(media);
  expect(screen.queryByLabelText("Search media")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Remove attachment" }),
  );
  expect(change).toHaveBeenLastCalledWith(null);
});
test("switches category, searches and offers retry on provider errors", async () => {
  renderComponent(<Picker onChange={() => {}} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Add GIF, sticker, meme or clip" }),
  );
  await fireEvent.press(screen.getByRole("tab", { name: "Memes" }));
  await waitFor(() =>
    expect(fetchMedia).toHaveBeenCalledWith(
      "static-memes",
      "",
      1,
      expect.anything(),
    ),
  );
  fetchMedia.mockRejectedValue(new Error("Offline"));
  await fireEvent.changeText(
    screen.getByLabelText("Search media"),
    "celebrate",
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Could not load media. Try again" }),
    ).toBeTruthy(),
  );
  fetchMedia.mockResolvedValue({ items: [{ media }], hasNext: false });
  await fireEvent.press(
    screen.getByRole("button", { name: "Could not load media. Try again" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Attach Party" })).toBeTruthy(),
  );
  expect(fetchMedia).toHaveBeenCalledWith(
    "static-memes",
    "celebrate",
    1,
    expect.anything(),
  );
});
