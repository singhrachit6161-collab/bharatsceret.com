import { z } from "zod";

/**
 * Razorpay webhook processing, independent of transport and storage so it can
 * be unit-tested. The route handler verifies the signature BEFORE calling this.
 */

const paymentEntity = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  order_id: z.string().nullable().optional(),
  method: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_description: z.string().nullable().optional(),
});

const refundEntity = z.object({
  id: z.string(),
  amount: z.number().int(),
  payment_id: z.string(),
  status: z.string().optional(),
  notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
});

export const webhookEventSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({ entity: paymentEntity }).optional(),
    refund: z.object({ entity: refundEntity }).optional(),
  }),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export interface WebhookDeps {
  /** Insert the event id; returns false if it was already processed successfully. */
  claimEvent(eventId: string, eventType: string, entityId: string | null): Promise<boolean>;
  completeEvent(eventId: string, status: "processed" | "ignored" | "failed", error?: string): Promise<void>;
  confirmPayment(providerOrderId: string, paymentId: string, amountPaise: number, method: string | null): Promise<string>;
  markAuthorized(providerOrderId: string, paymentId: string): Promise<void>;
  recordFailure(providerOrderId: string, paymentId: string, code: string | null, description: string | null): Promise<void>;
  syncRefund(input: {
    refundRequestId: string | null;
    paymentId: string;
    refundId: string;
    amountPaise: number;
    status: "pending" | "processed" | "failed";
  }): Promise<string>;
  onPaymentConfirmed?(providerOrderId: string, outcome: string): Promise<void>;
}

export type WebhookOutcome = { status: "processed" | "duplicate" | "ignored"; detail?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refundRequestIdFrom(notes: unknown): string | null {
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    const v = (notes as Record<string, unknown>).refund_request_id;
    if (typeof v === "string" && UUID_RE.test(v)) return v;
  }
  return null;
}

export async function processRazorpayWebhook(
  eventId: string,
  body: unknown,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const parsed = webhookEventSchema.safeParse(body);
  if (!parsed.success) return { status: "ignored", detail: "unrecognised payload" };
  const event = parsed.data;
  const payment = event.payload.payment?.entity;
  const refund = event.payload.refund?.entity;
  const entityId = refund?.id ?? payment?.id ?? null;

  const claimed = await deps.claimEvent(eventId, event.event, entityId);
  if (!claimed) return { status: "duplicate" };

  try {
    let detail: string | undefined;
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        if (!payment?.order_id || payment.status !== "captured") {
          await deps.completeEvent(eventId, "ignored", "payment not captured");
          return { status: "ignored", detail: "payment not captured" };
        }
        if (payment.currency !== "INR") throw new Error("Unexpected currency");
        detail = await deps.confirmPayment(payment.order_id, payment.id, payment.amount, payment.method ?? null);
        await deps.onPaymentConfirmed?.(payment.order_id, detail);
        break;
      }
      case "payment.authorized": {
        if (!payment?.order_id) break;
        await deps.markAuthorized(payment.order_id, payment.id);
        detail = "authorized";
        break;
      }
      case "payment.failed": {
        if (!payment?.order_id) break;
        await deps.recordFailure(payment.order_id, payment.id, payment.error_code ?? null, payment.error_description ?? null);
        detail = "failed";
        break;
      }
      case "refund.created":
      case "refund.processed":
      case "refund.failed": {
        if (!refund) break;
        const status =
          event.event === "refund.processed" ? "processed" : event.event === "refund.failed" ? "failed" : "pending";
        detail = await deps.syncRefund({
          refundRequestId: refundRequestIdFrom(refund.notes),
          paymentId: refund.payment_id,
          refundId: refund.id,
          amountPaise: refund.amount,
          status,
        });
        break;
      }
      default:
        await deps.completeEvent(eventId, "ignored", "event not handled");
        return { status: "ignored", detail: event.event };
    }
    await deps.completeEvent(eventId, "processed");
    return { status: "processed", detail };
  } catch (e) {
    const message = e instanceof Error ? e.message : "processing error";
    await deps.completeEvent(eventId, "failed", message.slice(0, 300));
    throw e;
  }
}
