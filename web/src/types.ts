export type Actor = {
  did: string;
  handle: string;
  displayName: string | null;
  avatar: string | null;
};

export type Currency = { name: string; symbol: string; decimals: number };

export type Network = {
  chainId: number;
  chainIdHex: string;
  name: string;
  nativeCurrency: Currency;
  rpcUrls?: string[];
};

export type Link = {
  did: string;
  address: string;
  chain_id: number;
  message: string;
  signature: string;
  linked_at: string;
  public: boolean;
  is_default: boolean;
};

export type Session = {
  network: Network;
  paymentsEnabled: boolean;
  did: string | null;
  csrf: string;
  links: Link[];
};

export type PaymentState =
  | "waiting"
  | "ready"
  | "prepared"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "expired";

export type Payment = {
  id: string;
  senderDid: string;
  recipientDid: string;
  recipientLabel: string;
  chainId: number;
  asset: string;
  amount: string;
  amountWei: string;
  state: PaymentState;
  address: string | null;
  revision: number;
  source: string;
  createdAt: string;
  expiresAt: string;
  txHash: string | null;
  error: string | null;
  confirmationsRequired: number;
  attemptId?: string | null;
  fromAddress?: string | null;
  nonce?: number | null;
};

export type Transaction = {
  from: string;
  to: string;
  value: string;
  chainId: string;
  nonce: string;
  data: string;
};

export type Attempt = {
  payment: Payment;
  attemptId: string;
  transaction: Transaction;
};

export type Recipient = {
  did: string;
  handle: string | null;
  chainId: number;
  address: string | null;
};

export type Challenge = {
  id: string;
  address: string;
  chainId: number;
  message: string;
  expiresAt: string;
};
