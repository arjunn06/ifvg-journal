// Temporary stub — payment verification will be migrated to Stripe webhooks.
export async function verifyZohoPayment(_orderId: string) {
  return { success: false, message: "Payment verification is being migrated to Stripe." };
}
