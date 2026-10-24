import React from "react";
import { createStore } from "jotai";
import {
  screen,
  fireEventAsync as fireEvent,
  waitFor,
} from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { renderComponent } from "../../../tests/render";
import { InvitationPanel } from "./InvitationPanel";
import { inviteTokenAtom } from "../../state";
import { request } from "../../api";
let mockSession;
jest.mock("../../hooks", () => ({
  useSession: () => ({ data: mockSession }),
  useAction: () => (fn) => fn(),
}));
jest.mock("../../api", () => ({ request: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn(async () => {}),
}));
const token = "a".repeat(64),
  address = "0x" + "1".repeat(40);
beforeEach(() => {
  mockSession = {
    did: "did:plc:recipient",
    network: { chainId: 1, name: "Ethereum" },
    links: [{ address, chain_id: 1, public: false }],
  };
  request.mockReset();
  request.mockResolvedValue({
    payment: {
      id: "p1",
      amount: "1",
      state: "waiting",
      senderDid: "did:plc:sender",
    },
  });
});
function mount() {
  const store = createStore();
  store.set(inviteTokenAtom, token);
  renderComponent(<InvitationPanel />, { store });
  return store;
}
test("preserves an invitation while signed out without fetching private details", () => {
  mockSession = null;
  const store = mount();
  expect(screen.getByText(/Sign in with the Atmosphere/)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  expect(store.get(inviteTokenAtom)).toBe(token);
});
test("only shares the chosen linked address after explicit acceptance", async () => {
  const store = mount();
  await fireEvent.press(await screen.findByRole("radio", { name: address }));
  expect(request).toHaveBeenCalledWith("getInvitation", undefined, { token });
  await fireEvent.press(
    screen.getByRole("button", { name: "Use this address for this payment" }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("acceptInvitation", {
      token,
      address,
    }),
  );
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("citrus-invitation");
  expect(store.get(inviteTokenAtom)).toBeNull();
});
test("does not offer acceptance for an expired invitation", async () => {
  request.mockResolvedValue({
    payment: { amount: "1", state: "expired", senderDid: "did:plc:sender" },
  });
  mount();
  expect(await screen.findByText(/can no longer be accepted/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Use this address for this payment" }),
  ).toBeNull();
});
