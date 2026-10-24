import { parseAmount } from "@peachlet/amounts";
import { z } from "zod";

/* These mirror the server's own rules so a typo is caught before a request is
   made — never instead of one. The server validates everything it receives. */
const didMethods = ["did:plc:", "did:web:"];

const handle = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const identifier = z
  .string()
  .transform((value) => value.trim().replace(/^@+/, ""))
  .refine((value) => value.length > 0, "Enter an AT Protocol handle or DID.")
  .refine(
    (value) =>
      value.startsWith("did:")
        ? value.length <= 2048 && didMethods.some((method) => value.startsWith(method))
        : value.length <= 253 && handle.test(value.toLowerCase()),
    "Enter a handle like alice.bsky.social, or a did:plc / did:web DID.",
  );

export const assetAmount = (decimals = 18, symbol = "ETH") => z.string()
  .transform(value => { const normalized = value.trim().replace(",", "."); return normalized.startsWith(".") ? `0${normalized}` : normalized; })
  .refine(value => { try { parseAmount(value, decimals); return true; } catch { return false; } },
    `Enter a positive ${symbol} amount with at most ${decimals} decimal places.`);
export const etherAmount = assetAmount();

export const transactionHash = z
  .string()
  .transform((value) => value.trim())
  .refine(
    (value) => /^0x[0-9a-fA-F]{64}$/.test(value),
    "Enter the 32-byte transaction hash, starting with 0x.",
  );

export const signInForm = z.object({ identifier });
export const recipientForm = z.object({ recipient: identifier });
export const assetAmountForm = (decimals = 18, symbol = "ETH") => z.object({ amount: assetAmount(decimals, symbol), description: z.string().trim().max(500, "Use 500 characters or fewer.").optional() });
export const amountForm = assetAmountForm();
export const recoverForm = z.object({ txHash: transactionHash });
export const inviteForm = z.object({
  address: z.string().min(1, "Choose a linked address."),
});
