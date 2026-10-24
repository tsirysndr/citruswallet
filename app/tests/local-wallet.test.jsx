const mockPrepare = jest.fn(async (tx) => ({ ...tx }));
const mockSign = jest.fn(async () => "0xdead");
const mockBroadcast = jest.fn(async () => "0xhash");
const mockChain = jest.fn(async () => 4326);
jest.mock("viem", () => ({
  ...jest.requireActual("viem"),
  createPublicClient: () => ({ getChainId: mockChain }),
  createWalletClient: () => ({
    prepareTransactionRequest: mockPrepare,
    signTransaction: mockSign,
    sendRawTransaction: mockBroadcast,
  }),
}));
jest.mock("../src/fee-quote", () => ({
  estimateFees: jest.fn(async (tx, chainId) => ({
    ...tx,
    chainId,
    value: BigInt(tx.value).toString(),
    nonce: Number(BigInt(tx.nonce)),
    gasLimit: "63349",
    maxFeePerGas: "1000000",
    maxPriorityFeePerGas: "0",
    maxFeeWei: "63349000000",
    expiresAt: Date.now() + 60000,
  })),
}));
const { TextEncoder, TextDecoder } = require("node:util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.crypto = require("node:crypto").webcrypto;
const mockStorage = new Map();
Object.defineProperty(require("react-native").AppState, "currentState", {
  configurable: true,
  writable: true,
  value: "active",
});
jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (key) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    mockStorage.delete(key);
  }),
  canUseBiometricAuthentication: () => false,
}));
jest.mock("../src/device-vault", () => ({
  storeDeviceSecret: jest.fn(),
  readDeviceSecret: jest.fn(),
  removeDeviceSecret: jest.fn(),
  deviceUnlockAvailable: jest.fn(async () => true),
}));
const device = require("../src/device-vault");
const vault = require("../src/local-wallet");
const secret = {
  kind: "mnemonic",
  value:
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
};
beforeEach(async () => {
  jest.clearAllMocks();
  device.storeDeviceSecret.mockResolvedValue(undefined);
  device.readDeviceSecret.mockResolvedValue(JSON.stringify(secret));
  vault.lockNativeWallet();
  mockStorage.clear();
  await vault.loadNativeVault();
});
afterEach(() => vault.lockNativeWallet());
test("native wallet encrypts storage with a separate device key and unlocks only with the PIN", async () => {
  await vault.createNativeVault(secret, "793184");
  expect(vault.nativeVaultState()).toBe("unlocked");
  expect(mockStorage.get("citrus-vault-v1")).not.toContain("abandon");
  expect(mockStorage.get("citrus-vault-device-key-v1")).toHaveLength(64);
  vault.lockNativeWallet();
  expect(vault.nativeAddress()).toBeNull();
  expect(vault.nativeBalanceAddress()).toBe(
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
  await vault.loadNativeVault();
  expect(vault.nativeBalanceAddress()).toBe(
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
  await vault.unlockNativeVault("793184");
  expect(vault.nativeAddress()).toBe(
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
  await expect(vault.createNativeVault(secret, "793184")).rejects.toThrow(
    "already exists",
  );
});
test("wrong PIN remains locked and repeated attempts are throttled", async () => {
  await vault.createNativeVault(secret, "793184");
  vault.lockNativeWallet();
  await expect(vault.unlockNativeVault("000000")).rejects.toThrow(
    "Unable to unlock",
  );
  expect(vault.nativeVaultState()).toBe("locked");
  await expect(vault.unlockNativeVault("000000")).rejects.toThrow(
    "Wait a moment",
  );
});
test("an interrupted native unlock cannot restore the in-memory signing key", async () => {
  await vault.createNativeVault(secret, "793184");
  vault.lockNativeWallet();
  const unlocking = vault.unlockNativeVault("793184");
  vault.lockNativeWallet();
  await expect(unlocking).rejects.toThrow("interrupted");
  expect(vault.nativeAddress()).toBeNull();
});

test("password protection encrypts the vault and unlocks with the chosen password", async () => {
  await vault.createProtectedNativeVault(
    secret,
    "password",
    "a long wallet password",
  );
  expect(vault.nativeProtection()).toBe("password");
  expect(mockStorage.get("citrus-vault-v1")).not.toContain(secret.value);
  vault.lockNativeWallet();
  await vault.loadNativeVault();
  expect(vault.nativeProtection()).toBe("password");
  await vault.unlockNativeVault("a long wallet password");
  expect(vault.nativeAddress()).toBe(
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
});
test("device unlock stores no plaintext or password key in SecureStore and cancellation stays locked", async () => {
  await vault.createProtectedNativeVault(secret, "device");
  expect(device.storeDeviceSecret).toHaveBeenCalledWith(JSON.stringify(secret));
  expect(mockStorage.has("citrus-vault-device-key-v1")).toBe(false);
  expect(mockStorage.get("citrus-vault-v1")).not.toContain(secret.value);
  vault.lockNativeWallet();
  await vault.loadNativeVault();
  device.readDeviceSecret.mockRejectedValueOnce(new Error("Cancelled"));
  await expect(vault.unlockNativeVault("")).rejects.toThrow("Cancelled");
  expect(vault.nativeAddress()).toBeNull();
  expect(vault.nativeVaultState()).toBe("locked");
  await vault.unlockNativeVault("");
  expect(vault.nativeVaultState()).toBe("unlocked");
});
test("failed upgrade preserves the original PIN vault and successful upgrade removes its password key", async () => {
  await vault.createNativeVault(secret, "793184");
  const original = mockStorage.get("citrus-vault-v1");
  device.storeDeviceSecret.mockRejectedValueOnce(new Error("Cancelled"));
  await expect(
    vault.upgradeNativeProtection("793184", "device"),
  ).rejects.toThrow("Cancelled");
  expect(mockStorage.get("citrus-vault-v1")).toBe(original);
  expect(vault.nativeProtection()).toBe("legacy-pin");
  await vault.upgradeNativeProtection("793184", "device");
  expect(vault.nativeProtection()).toBe("device");
  expect(mockStorage.has("citrus-vault-device-key-v1")).toBe(false);
  vault.lockNativeWallet();
  await vault.unlockNativeVault("");
  expect(vault.nativeVaultState()).toBe("unlocked");
});
test("a manual lock during system authentication prevents late unlock", async () => {
  await vault.createProtectedNativeVault(secret, "device");
  vault.lockNativeWallet();
  let resolve;
  device.readDeviceSecret.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const unlocking = vault.unlockNativeVault("");
  vault.lockNativeWallet();
  resolve(JSON.stringify(secret));
  await expect(unlocking).rejects.toThrow("locked");
  expect(vault.nativeAddress()).toBeNull();
});
test("device-protected wallets can switch to an independently encrypted password vault", async () => {
  await vault.createProtectedNativeVault(secret, "device");
  await vault.upgradeNativeProtection("", "password", "another long password");
  expect(vault.nativeProtection()).toBe("password");
  expect(device.removeDeviceSecret).toHaveBeenCalled();
  expect(mockStorage.get("citrus-vault-v1")).not.toContain(secret.value);
  vault.lockNativeWallet();
  await vault.unlockNativeVault("another long password");
  expect(vault.nativeAddress()).toBe(
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
});

test("native signing uses the exact MegaETH quote and reserved nonce after approval", async () => {
  await vault.createProtectedNativeVault(secret, "device", "");
  const network = {
    chainId: 4326,
    chainIdHex: "0x10e6",
    name: "MegaETH",
    rpcUrls: ["https://rpc.example"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  };
  const tx = {
    from: vault.nativeAddress(),
    to: "0x1111111111111111111111111111111111111111",
    value: "0x1",
    nonce: "0x7",
    data: "0x",
    chainId: "0x10e6",
  };
  const approval = jest
    .spyOn(require("react-native").Alert, "alert")
    .mockImplementation((title, text, buttons) => buttons[1].onPress());
  try {
    await vault
      .nativeProvider(network)
      .request({ method: "eth_sendTransaction", params: [tx] });
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.objectContaining({
        gas: 63349n,
        maxFeePerGas: 1000000n,
        nonce: 7,
        value: 1n,
        to: tx.to,
      }),
    );
    expect(mockSign).toHaveBeenCalledTimes(1);
    expect(mockBroadcast).toHaveBeenCalledWith({
      serializedTransaction: "0xdead",
    });
  } finally {
    approval.mockRestore();
  }
});

test("native signing refuses a wrong-chain quote before approval or broadcast", async () => {
  await vault.createProtectedNativeVault(secret, "device", "");
  const network = {
    chainId: 4326,
    chainIdHex: "0x10e6",
    name: "MegaETH",
    rpcUrls: ["https://rpc.example"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  };
  const tx = {
    from: vault.nativeAddress(),
    to: "0x1111111111111111111111111111111111111111",
    value: "0x1",
    nonce: "0x7",
    data: "0x",
    chainId: "0x10e6",
  };
  require("../src/fee-quote").estimateFees.mockResolvedValueOnce({
    chainId: 1,
  });
  await expect(
    vault
      .nativeProvider(network)
      .request({ method: "eth_sendTransaction", params: [tx] }),
  ).rejects.toThrow("does not match");
  expect(mockSign).not.toHaveBeenCalled();
  expect(mockBroadcast).not.toHaveBeenCalled();
});
