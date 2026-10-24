/* Notification shapes and wording, kept free of expo-notifications so screens
   and tests can use them without starting the push handler. */
export type NoticeKind = "payment_received" | "recipient_ready";
export type Notice = {
  id: string;
  paymentId: string;
  kind: NoticeKind | string;
  createdAt: string;
  read: boolean;
};
/* An unknown kind from a newer server still renders as something truthful. */
export const noticeLabel = (kind: string) =>
  kind === "recipient_ready"
    ? "Invitation accepted · ready to send"
    : kind === "payment_received"
      ? "Payment received"
      : "Payment update";
