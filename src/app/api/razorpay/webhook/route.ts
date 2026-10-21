import { NextResponse, type NextRequest } from "next/server";
import { notify } from "@/lib/notifications";
import { processRazorpayWebhook, type WebhookDeps } from "@/lib/razorpay-webhook";
import { verifyWebhookSignature } from "@/lib/razorpay-signature";
import { isServiceRoleConfigured, serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Razorpay webhook endpoint. Signature is verified against the exact raw body
 * BEFORE parsing. Every event id is recorded so duplicate deliveries are no-ops.
 * Uses the service role because webhook calls have no user session; all state
 * changes go through idempotent database functions.
 */
export async function POST(request: NextRequest) {
  if (!serverEnv.razorpayWebhookSecret || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature, serverEnv.razorpayWebhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId || eventId.length > 100) return NextResponse.json({ error: "missing event id" }, { status: 400 });

  const db = createServiceClient();
  const deps: WebhookDeps = {
    async claimEvent(id, type, entityId) {
      const { error } = await db.from("payment_webhook_events").insert({ event_id: id, event_type: type, entity_id: entityId });
      if (!error) return true;
      if (error.code !== "23505") throw new Error("could not record event");
      // Already seen: re-process only if the previous attempt failed.
      const { data } = await db.from("payment_webhook_events").select("status").eq("event_id", id).maybeSingle();
      if (data?.status !== "failed") return false;
      const { data: reclaimed } = await db
        .from("payment_webhook_events")
        .update({ status: "received", error: null })
        .eq("event_id", id)
        .eq("status", "failed")
        .select("id");
      return Boolean(reclaimed?.length);
    },
    async completeEvent(id, status, error) {
      await db
        .from("payment_webhook_events")
        .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
        .eq("event_id", id);
    },
    async confirmPayment(providerOrderId, paymentId, amount, method) {
      const { data, error } = await db.rpc("confirm_online_payment", {
        p_provider_order_id: providerOrderId,
        p_provider_payment_id: paymentId,
        p_amount_paise: amount,
        p_method: method,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    async markAuthorized(providerOrderId, paymentId) {
      await db
        .from("payments")
        .update({ status: "authorized", provider_payment_id: paymentId })
        .eq("provider_order_id", providerOrderId)
        .in("status", ["created", "failed"]);
    },
    async recordFailure(providerOrderId, paymentId, code, description) {
      const { error } = await db.rpc("record_payment_failure", {
        p_provider_order_id: providerOrderId,
        p_provider_payment_id: paymentId,
        p_error_code: code,
        p_error_description: description,
      });
      if (error) throw new Error(error.message);
    },
    async syncRefund(input) {
      const { data, error } = await db.rpc("sync_refund", {
        p_refund_request_id: input.refundRequestId,
        p_provider_payment_id: input.paymentId,
        p_provider_refund_id: input.refundId,
        p_amount_paise: input.amountPaise,
        p_status: input.status,
        p_failure_reason: input.status === "failed" ? "Reported failed by gateway" : null,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    async onPaymentConfirmed(providerOrderId, outcome) {
      if (outcome !== "confirmed" && outcome !== "late_confirmed") return;
      const { data } = await db
        .from("payments")
        .select("orders!inner (order_number, contact_email, total_paise)")
        .eq("provider_order_id", providerOrderId)
        .maybeSingle();
      const o = data?.orders as unknown as { order_number: string; contact_email: string | null; total_paise: number } | undefined;
      if (o) await notify("payment_confirmed", { to: o.contact_email, orderNumber: o.order_number, totalPaise: Number(o.total_paise) });
    },
  };

  try {
    const result = await processRazorpayWebhook(eventId, body, deps);
    return NextResponse.json({ ok: true, result: result.status });
  } catch (e) {
    console.error("[webhook] processing failed", eventId, e instanceof Error ? e.message : "");
    // Non-2xx makes Razorpay retry; the event was marked failed so a retry re-processes it.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
