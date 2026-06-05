// Temporary stub — payment verification will be migrated to Stripe webhooks.
export async function verifyZohoPayment(_orderId: string): Promise<{
  success: boolean;
  status: string;
  transactionId: string | null;
  message: string;
}> {
  return {
    success: false,
    status: "pending",
    transactionId: null,
    message: "Payment verification is being migrated to Stripe.",
  };
}
