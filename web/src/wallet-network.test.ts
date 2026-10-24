import { afterEach, expect, it, vi } from "vitest";
import { walletAccount } from "./wallet";
const address = "0x1111111111111111111111111111111111111111";
const network = {
  chainId: 4326,
  chainIdHex: "0x10e6",
  name: "MegaETH",
  rpcUrls: ["https://mainnet.megaeth.com/rpc"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};
afterEach(() => vi.useRealTimers());
function provider(add: () => Promise<void>) {
  let chain = "0x1";
  const wallet = {
    request: vi.fn(async ({ method }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts")
        return [address];
      if (method === "eth_chainId") return chain;
      if (method === "wallet_switchEthereumChain") throw { code: 4902 };
      if (method === "wallet_addEthereumChain") return add();
      throw new Error(method);
    }),
  };
  return {
    wallet,
    activate: () => {
      chain = network.chainIdHex;
    },
  };
}
it("joins simultaneous network requests and skips a redundant switch after adding", async () => {
  let approve!: () => void;
  const { wallet, activate } = provider(
    () =>
      new Promise<void>((resolve) => {
        approve = () => {
          activate();
          resolve();
        };
      }),
  );
  const first = walletAccount(wallet, network),
    second = walletAccount(wallet, network);
  expect(second).toBe(first);
  await vi.waitFor(() => expect(approve).toBeTypeOf("function"));
  approve();
  expect(await first).toBe(address);
  expect(
    wallet.request.mock.calls.filter(
      ([arg]) => arg.method === "wallet_addEthereumChain",
    ),
  ).toHaveLength(1);
  expect(
    wallet.request.mock.calls.filter(
      ([arg]) => arg.method === "wallet_switchEthereumChain",
    ),
  ).toHaveLength(1);
});
it("waits for an existing add-chain approval without sending it again", async () => {
  vi.useFakeTimers();
  const { wallet, activate } = provider(async () => {
    throw { data: { originalError: { code: -32002 } } };
  });
  const status = vi.fn();
  const promise = walletAccount(wallet, network, status);
  await vi.advanceTimersByTimeAsync(1000);
  expect(status).toHaveBeenCalledWith(
    expect.stringContaining("pending network request"),
  );
  activate();
  await vi.advanceTimersByTimeAsync(750);
  expect(await promise).toBe(address);
  expect(
    wallet.request.mock.calls.filter(
      ([arg]) => arg.method === "wallet_addEthereumChain",
    ),
  ).toHaveLength(1);
});
it("times out with instructions and never links on the wrong network", async () => {
  vi.useFakeTimers();
  const { wallet } = provider(async () => {
    throw { code: -32002 };
  });
  const rejected = expect(walletAccount(wallet, network)).rejects.toThrow(
    "Open MetaMask",
  );
  await vi.advanceTimersByTimeAsync(31_000);
  await rejected;
  expect(
    wallet.request.mock.calls.filter(
      ([arg]) => arg.method === "wallet_addEthereumChain",
    ),
  ).toHaveLength(1);
});
it("propagates rejection without retrying or waiting", async () => {
  const error = { code: 4001, message: "Rejected" };
  const { wallet } = provider(async () => {
    throw error;
  });
  await expect(walletAccount(wallet, network)).rejects.toBe(error);
});
it("uses the already-authorized account when a pending request blocks account permission prompts", async () => {
  const { wallet, activate } = provider(async () => {
    activate();
  });
  const request = wallet.request.getMockImplementation()!;
  wallet.request.mockImplementation(async (args) => {
    if (args.method === "eth_requestAccounts") throw { code: -32002 };
    return request(args);
  });
  expect(await walletAccount(wallet, network)).toBe(address);
});
