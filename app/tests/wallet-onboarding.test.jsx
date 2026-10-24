import { renderHook, waitFor } from "@testing-library/react-native";
import { useWalletOnboarding } from "../src/useWalletOnboarding";
const session = { did: "did:plc:me", links: [] };

test.each([
  ["locked built-in wallet", "locked", null, []],
  ["unlocked built-in wallet", "unlocked", null, []],
  ["saved external wallet", "absent", "0x123", []],
  [
    "private link on another chain",
    "absent",
    null,
    [{ public: false, is_default: false, chain_id: 6343 }],
  ],
  ["link requiring a fresh proof", "absent", null, [{ requires_relink: true }]],
])("skips onboarding for %s", async (_, vault, address, links) => {
  const { result } = renderHook(() =>
    useWalletOnboarding(true, false, { ...session, links }, vault, address),
  );
  await waitFor(() => expect(result.current[0]).toBe(false));
});

test("a new account needs setup, but an arriving link exits it without restarting", async () => {
  const { result, rerender } = renderHook(
    ({ data }) => useWalletOnboarding(true, false, data, "absent", null),
    { initialProps: { data: session } },
  );
  await waitFor(() => expect(result.current[0]).toBe(true));
  rerender({ data: { ...session, links: [{ is_default: false }] } });
  await waitFor(() => expect(result.current[0]).toBe(false));
});

test("sign-out still requires sign-in even with a configured wallet", async () => {
  const { result, rerender } = renderHook(
    ({ did }) =>
      useWalletOnboarding(true, false, { ...session, did }, "locked", null),
    { initialProps: { did: session.did } },
  );
  await waitFor(() => expect(result.current[0]).toBe(false));
  rerender({ did: null });
  await waitFor(() => expect(result.current[0]).toBe(true));
});
