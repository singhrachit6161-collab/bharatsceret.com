import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time comparison of two hex digests. */
function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[a-f0-9]+$/i.test(received)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Standard Checkout signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyCheckoutSignature(
  params: { orderId: string; paymentId: string; signature: string },
  keySecret: string,
): boolean {
  if (!keySecret || !params.orderId || !params.paymentId || !params.signature) return false;
  const expected = createHmac("sha256", keySecret).update(`${params.orderId}|${params.paymentId}`).digest("hex");
  return safeEqualHex(expected, params.signature);
}

/**
 * Webhook signature: HMAC-SHA256 of the EXACT raw request body using the
 * webhook secret, sent in the X-Razorpay-Signature header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody, "utf8").digest("hex");
  return safeEqualHex(expected, signature);
}
