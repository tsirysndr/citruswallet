import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloudBackup } from "./index";
const mocks = vi.hoisted(() => ({
  state: "absent",
  connect: vi.fn(),
  list: vi.fn(),
  download: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
}));
vi.mock("../../cloud-auth", () => ({
  cloudConfigured: () => true,
  connectCloud: mocks.connect,
  prepareGoogleAuth: async () => {},
}));
vi.mock("../../local-wallet", () => ({
  localWalletState: () => mocks.state,
  subscribeWallet: () => () => {},
  saveLocalWallet: mocks.save,
  backupLocalWallet: mocks.read,
}));
vi.mock("@peachlet/wallet-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@peachlet/wallet-core")>()),
  listCloudBackups: mocks.list,
  downloadCloudBackup: mocks.download,
  restoreCloudBackup: mocks.restore,
  uploadCloudBackup: mocks.upload,
  createCloudBackup: mocks.create,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = "absent";
  mocks.connect.mockResolvedValue("provider-token");
  mocks.list.mockResolvedValue([
    { id: "backup1", name: "peachlet-test.json", modifiedAt: "2026-10-24" },
  ]);
  mocks.download.mockResolvedValue("encrypted backup");
  mocks.restore.mockResolvedValue({ kind: "privateKey", value: "test-secret" });
  mocks.save.mockResolvedValue(undefined);
});
it("restores a selected backup only after password validation and decryption", async () => {
  const user = userEvent.setup(),
    done = vi.fn();
  render(<CloudBackup onRestored={done} />);
  await user.click(screen.getByRole("button", { name: "Dropbox" }));
  await user.selectOptions(
    await screen.findByLabelText("Backup to restore"),
    "backup1",
  );
  await user.type(
    screen.getByLabelText("Backup password"),
    "test backup password",
  );
  await user.click(screen.getByRole("button", { name: "Restore wallet" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(mocks.save).toHaveBeenCalledWith(
    { kind: "privateKey", value: "test-secret" },
    "test backup password",
  );
});
it("does not create a wallet when decrypting fails", async () => {
  mocks.restore.mockRejectedValueOnce(new Error("Wrong backup password"));
  const user = userEvent.setup();
  render(<CloudBackup />);
  await user.click(screen.getByRole("button", { name: "Dropbox" }));
  await user.selectOptions(
    await screen.findByLabelText("Backup to restore"),
    "backup1",
  );
  await user.type(
    screen.getByLabelText("Backup password"),
    "wrong backup password",
  );
  await user.click(screen.getByRole("button", { name: "Restore wallet" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Wrong backup password",
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
it("backs up existing wallets without offering overwrite restore", async () => {
  mocks.state = "locked";
  mocks.read.mockResolvedValue({ kind: "privateKey", value: "test-secret" });
  mocks.create.mockResolvedValue("encrypted-only");
  mocks.upload.mockResolvedValue({ id: "backup2" });
  const user = userEvent.setup();
  render(<CloudBackup />);
  await user.click(screen.getByRole("button", { name: "Dropbox" }));
  await user.type(
    await screen.findByLabelText("Current wallet password"),
    "local password",
  );
  await user.type(
    screen.getByLabelText("Backup password"),
    "test backup password",
  );
  await user.type(
    screen.getByLabelText("Repeat backup password"),
    "test backup password",
  );
  await user.click(
    screen.getByRole("button", { name: "Save encrypted backup" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "saved and verified",
  );
  expect(mocks.upload).toHaveBeenCalledWith(
    "dropbox",
    "provider-token",
    "encrypted-only",
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
