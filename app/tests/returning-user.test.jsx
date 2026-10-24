const mockStorage = new Map();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    mockStorage.delete(key);
  }),
}));
jest.mock("../src/local-wallet", () => ({ lockNativeWallet: jest.fn() }));
jest.mock("../src/network", () => ({ selectedChain: () => null }));
function freshApi() {
  let api;
  jest.isolateModules(() => {
    api = require("../src/api");
  });
  return api;
}
beforeEach(() => mockStorage.clear());
test("remembers a returning user across logout and a cold restart without retaining the session", async () => {
  const api = freshApi();
  await api.saveToken("test-session");
  await api.saveToken(null);
  const restarted = freshApi();
  await restarted.loadToken();
  expect(restarted.hasSignedIn()).toBe(true);
  expect(restarted.currentToken()).toBeNull();
});
test("migrates an existing signed-in installation", async () => {
  mockStorage.set("citrus-session", "test-session");
  const api = freshApi();
  await api.loadToken();
  expect(api.hasSignedIn()).toBe(true);
  expect(mockStorage.get("citrus-has-signed-in")).toBe("true");
});
test("does not classify a fresh installation as returning", async () => {
  const api = freshApi();
  await api.loadToken();
  expect(api.hasSignedIn()).toBe(false);
});
test("recognizes an older already-signed-out installation by its saved wallet choice", async () => {
  mockStorage.set("citrus-wallet-mode", "citrus");
  const api = freshApi();
  await api.loadToken();
  expect(api.hasSignedIn()).toBe(true);
  expect(api.currentToken()).toBeNull();
});
