// Temporary stub — payment verification will be migrated to Stripe webhooks.
export async function verifyZohoPayment(_orderId: string) {
  return {
    success: false,
    status: "pending" as const,
    transactionId: null as string | null,
    message: "Payment verification is being migrated to Stripe.",
  };
}
