import React from "react";
import {
  render,
  screen,
  fireEventAsync as fireEvent,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "jotai";
import { Account } from "../src/screens/Account";
const address = "0x1111111111111111111111111111111111111111";
let mockLocalAddress = null,
  mockVaultState = "absent",
  mockWalletMode = "citrus";
const mockSession = {
  did: "did:plc:me",
  links: [],
  network: {
    chainId: 4326,
    name: "MegaETH",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.example"],
  },
};
jest.mock("../src/hooks", () => ({
  useSession: () => ({ data: mockSession }),
  useProfile: () => ({ data: { did: "did:plc:me", handle: "me.test" } }),
  useAction: () => (fn) => fn(),
}));
jest.mock("../src/local-wallet", () => ({
  nativeBalanceAddress: () => mockLocalAddress,
  nativeVaultState: () => mockVaultState,
  subscribeNativeVault: () => () => {},
}));
jest.mock("../src/wallet-preferences", () => ({
  walletMode: () => mockWalletMode,
}));
jest.mock("../src/wallet-unlock", () => ({
  requestUnlock: jest.fn(async () => {}),
}));
jest.mock("../src/api", () => ({ request: jest.fn(), saveToken: jest.fn() }));
jest.mock("../src/auth", () => ({ signIn: jest.fn() }));
jest.mock("../src/network", () => ({ deviceNetwork: (network) => network }));
jest.mock("../src/components/AssetBalances", () => ({
  AssetBalances: () => null,
}));
jest.mock("../src/components/HandleInput", () => ({ HandleInput: () => null }));
jest.mock("../src/components/AtmosphereApps", () => ({
  AtmosphereApps: () => null,
}));
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <Provider>
      <QueryClientProvider client={client}>
        <Account />
      </QueryClientProvider>
    </Provider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockWalletMode = "citrus";
  mockLocalAddress = null;
  mockVaultState = "absent";
  mockSession.links = [];
  global.fetch = jest.fn();
  require("../src/api").request.mockResolvedValue({
    usd: "2000",
    updatedAt: Date.now(),
    source: "Coinbase",
  });
});
test("an empty MegaETH account shows 0 ETH without needing an RPC request", async () => {
  mount();
  expect(await screen.findByText("0 ETH")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
test("loads the local wallet even while locked and before it is linked", async () => {
  mockLocalAddress = address;
  mockVaultState = "locked";
  fetch.mockResolvedValue({ ok: true, json: async () => ({ result: "0x0" }) });
  mount();
  expect(await screen.findByText("0 ETH")).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[0][1].body).params[0]).toBe(address);
});
test("RPC failures are unavailable, not a false zero", async () => {
  mockLocalAddress = address;
  mockVaultState = "locked";
  fetch.mockRejectedValue(new Error("offline"));
  mount();
  expect(await screen.findByText("ETH balance unavailable")).toBeTruthy();
  expect(screen.queryByText("0 ETH")).toBeNull();
});
test("asks to unlock legacy wallets whose address is not cached yet", async () => {
  mockVaultState = "locked";
  mount();
  expect(await screen.findByText("Unlock to load balance")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test("shows unlock even with a loaded balance or hidden amount, and opens the existing unlock flow", async () => {
  mockLocalAddress = address;
  mockVaultState = "locked";
  fetch.mockResolvedValue({ ok: true, json: async () => ({ result: "0x0" }) });
  mount();
  await screen.findByText("0 ETH");
  expect(screen.getByRole("button", { name: "Unlock wallet" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "Hide balance" }));
  await fireEvent.press(screen.getByRole("button", { name: "Unlock wallet" }));
  expect(require("../src/wallet-unlock").requestUnlock).toHaveBeenCalledTimes(
    1,
  );
});
test.each(["unlocked", "absent"])(
  "does not offer unlock when the local wallet is %s",
  async (state) => {
    mockVaultState = state;
    mockLocalAddress = state === "unlocked" ? address : null;
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: "0x0" }),
    });
    mount();
    await screen.findByText("0 ETH");
    expect(screen.queryByRole("button", { name: "Unlock wallet" })).toBeNull();
  },
);
test("does not offer local-wallet unlock when MetaMask is selected", async () => {
  mockVaultState = "locked";
  mockWalletMode = "metamask";
  mockLocalAddress = address;
  fetch.mockResolvedValue({ ok: true, json: async () => ({ result: "0x0" }) });
  mount();
  await screen.findByText("0 ETH");
  expect(screen.queryByRole("button", { name: "Unlock wallet" })).toBeNull();
});

test("keeps identity off the account page until its avatar is tapped", async () => {
  mount();
  await screen.findByText("0 ETH");
  expect(screen.queryByText("Your identity")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Account information" }),
  );
  expect(screen.getByText("Your identity")).toBeTruthy();
  expect(screen.getByText("@me.test")).toBeTruthy();
});

test("shows the combined USD value of ETH and tokens and hides both amounts", async () => {
  mockSession.links = [{ address, chain_id: 4326 }];
  const contract = "0x4444444444444444444444444444444444444444";
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ result: "0xde0b6b3a7640000" }),
  });
  require("../src/api").request.mockImplementation(async (method) =>
    method === "getEthPrice"
      ? { usd: "2000", updatedAt: Date.now(), source: "Coinbase" }
      : {
          assets: [
            {
              address,
              balanceAtomic: "10000000",
              usdPrice: "1",
              asset: {
                id: `eip155:4326/erc20:${contract}`,
                chainId: 4326,
                kind: "erc20",
                contractAddress: contract,
                decimals: 6,
              },
            },
          ],
          discoveryAvailable: true,
        },
  );
  mount();
  expect(await screen.findByText("$2,010.00")).toBeTruthy();
  expect(screen.getByText("1 ETH")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Hide balance" }));
  expect(screen.queryByText("$2,010.00")).toBeNull();
  expect(screen.queryByText("1 ETH")).toBeNull();
});
