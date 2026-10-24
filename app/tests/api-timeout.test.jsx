jest.mock("../src/local-wallet", () => ({ lockNativeWallet: jest.fn() }));
jest.mock("../src/network", () => ({ selectedChain: () => "6343" }));
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const { request } = require("../src/api");
beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
});
afterEach(() => jest.useRealTimers());
test("recipient lookup rejects on deadline even if native fetch ignores abort", async () => {
  fetch.mockImplementation(() => new Promise(() => {}));
  const call = request(
    "resolveRecipient",
    { identifier: "alice.test" },
    undefined,
    { timeoutMs: 15000 },
  );
  const expected = expect(call).rejects.toThrow("Recipient lookup timed out");
  await jest.advanceTimersByTimeAsync(15000);
  await expected;
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
test("deadline covers stalled response bodies too", async () => {
  fetch.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
  const call = request("resolveRecipient", {}, undefined, { timeoutMs: 15000 });
  const expected = expect(call).rejects.toThrow("Recipient lookup timed out");
  await jest.advanceTimersByTimeAsync(15000);
  await expected;
});
test("cancels immediately and clears the deadline", async () => {
  fetch.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const call = request("resolveRecipient", {}, undefined, {
    signal: controller.signal,
  });
  const expected = expect(call).rejects.toThrow("Request cancelled");
  controller.abort();
  await expected;
  expect(jest.getTimerCount()).toBe(0);
});
test("returns a successful response and clears its timer", async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ did: "did:plc:alice" }),
  });
  expect(await request("resolveRecipient", {})).toEqual({
    did: "did:plc:alice",
  });
  expect(jest.getTimerCount()).toBe(0);
});
