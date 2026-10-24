import { sendPayment } from "../src/wallet";
import { request } from "../src/api";

jest.mock("../src/api", () => ({
  origin: "https://peachlet.app",
  request: jest.fn(),
}));
jest.mock("@metamask/connect-evm", () => ({ createEVMClient: jest.fn() }));
jest.mock("../src/wallet-connection", () => ({
  nativeWalletUI: {},
  withWalletDeadline: (promise) => promise,
}));
jest.mock("../src/wallet-preferences", () => ({
  walletMode: () => "citrus",
}));
jest.mock("../src/wallet-unlock", () => ({ requestUnlock: jest.fn() }));
jest.mock("../src/local-wallet", () => ({
  nativeProvider: jest.fn(),
  nativeVaultState: () => {
    throw new Error("connect reached");
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const did = "did:plc:bobbbbbbbbbbbbbbbbbbbbbb";
const address = "0x1111111111111111111111111111111111111111";
const network = { chainId: 1, chainIdHex: "0x1", name: "Ethereum mainnet" };
const payment = {
  id: "payment-1",
  revision: 1,
  recipientDid: did,
  recipient: { handle: "bob.test" },
  address,
  chainId: 1,
  asset: "ETH",
  amount: "0.01",
  amountWei: "10000000000000000",
};

const reply = (body, status = 200) => ({
  ok: status < 300,
  status,
  text: async () => JSON.stringify(body),
});

function serve(record) {
  global.fetch = jest.fn(async (url) =>
    String(url).startsWith("https://plc.directory/")
      ? reply({
          id: did,
          service: [
            { id: "#atproto_pds", serviceEndpoint: "https://pds.example" },
          ],
        })
      : record
        ? reply(record)
        : reply({ error: "RecordNotFound" }, 400),
  );
}

afterEach(() => {
  jest.clearAllMocks();
  delete global.fetch;
});

/* The API reports an address, the recipient's own repository contradicts it:
   nothing may be prepared, connected, or signed. */
it("refuses to send when the recipient's published proof covers another address", async () => {
  serve({
    uri: `at://${did}/app.peachlet.address/eip155-1-${address}`,
    value: {
      chain: "eip155:1",
      address: "0x3333333333333333333333333333333333333333",
      message: "proof",
      signature: `0x${"ab".repeat(65)}`,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  });
  await expect(sendPayment("did:plc:me", network, payment)).rejects.toThrow(
    /Do not send to this address/,
  );
  expect(request).not.toHaveBeenCalled();
});

/* An address with no published proof cannot be verified, and must not become an
   outage: private links are never published. The payment proceeds to the wallet. */
it("still prepares a payment when no proof is published", async () => {
  serve(null);
  await expect(sendPayment("did:plc:me", network, payment)).rejects.toThrow(
    /connect reached/,
  );
});
