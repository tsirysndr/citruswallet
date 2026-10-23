import type { Actor, Session, Payment, Link } from "../../types";
export const alice: Actor = {
  did: "did:plc:alice",
  handle: "alice.test",
  displayName: "Alice",
  avatar: null,
};
export const bob: Actor = {
  did: "did:plc:bob",
  handle: "bob.test",
  displayName: "Bob",
  avatar: "https://cdn.bsky.app/bob.jpg",
};
export const address = "0x1111111111111111111111111111111111111111";
export const linkedAddress: Link = {
  did: alice.did,
  address,
  chain_id: 1,
  message: "proof",
  signature: "0x00",
  linked_at: "2026-01-01T00:00:00Z",
  public: true,
  is_default: false,
};
export const session: Session = {
  did: alice.did,
  csrf: "test-csrf",
  links: [],
  addressSyncPending: false,
  paymentsEnabled: true,
  network: {
    chainId: 1,
    chainIdHex: "0x1",
    name: "Ethereum mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};
export const signedOut: Session = { ...session, did: null };
export const payment: Payment = {
  id: "payment-1",
  senderDid: alice.did,
  recipientDid: bob.did,
  recipientLabel: bob.handle,
  sender: alice,
  recipient: bob,
  chainId: 1,
  asset: "ETH",
  amount: "0.01",
  amountWei: "10000000000000000",
  state: "ready",
  address,
  revision: 1,
  source: "public",
  description: "Dinner with friends",
  createdAt: "2026-01-01T12:00:00Z",
  expiresAt: "2027-01-01T12:00:00Z",
  txHash: null,
  error: null,
  confirmationsRequired: 2,
};
export const media = {
  kind: "gifs" as const,
  slug: "thanks",
  title: "Thank you",
  url: "https://static.klipy.com/thanks.gif",
  preview: "https://static.klipy.com/thanks.webp",
};
