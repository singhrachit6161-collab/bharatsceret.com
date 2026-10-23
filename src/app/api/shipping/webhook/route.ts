import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ensureInvoice } from "@/lib/data/invoices";
import { notify } from "@/lib/notifications";
import { isServiceRoleConfigured, serverEnv } from "@/lib/server-env";
import { mapShiprocketStatus, parseShiprocketTime, trackingUrl } from "@/lib/shipping/shiprocket";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Shiprocket tracking webhook (Shiprocket → Settings → API → Webhooks).
 * The URL deliberately avoids the word "shiprocket", which Shiprocket rejects.
 * Shiprocket sends the token you configure there in the `x-api-key` header;
 * set the same value as SHIPROCKET_WEBHOOK_TOKEN. Events are applied exactly
 * once (unique external event id) and only move orders forward.
 */
function authorized(request: NextRequest): boolean {
  const secret = serverEnv.shiprocketWebhookToken;
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(request.headers.get("x-api-key") ?? "");
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const awb = String(body.awb ?? "").trim();
  const label = String(body.current_status ?? body.shipment_status ?? "").trim();
  const status = mapShiprocketStatus(label);
  // Acknowledge events we do not track so Shiprocket does not keep retrying them.
  if (!awb || !status) return NextResponse.json({ ok: true, ignored: true });

  const scans = Array.isArray(body.scans) ? (body.scans as Record<string, unknown>[]) : [];
  const last = scans[scans.length - 1];
  const occurredAt = parseShiprocketTime(body.current_timestamp) ?? new Date().toISOString();
  const db = createServiceClient();
  const { data, error } = await db.rpc("apply_carrier_event", {
    p_provider: "shiprocket",
    p_tracking_number: awb,
    p_status: status,
    p_description: label,
    p_location: last?.location ? String(last.location) : null,
    p_external_id: `${awb}:${label}:${String(body.current_timestamp ?? "")}`,
    p_occurred_at: occurredAt,
  });
  if (error) {
    console.error(`[shipping-webhook] apply failed for AWB ${awb}: ${error.message}`);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  const result = data as { result: string; order_id?: string; order_status?: string; order_number?: string; contact_email?: string | null };
  if (result.result === "applied" && result.order_number) {
    if (result.order_status === "shipped" || result.order_status === "delivered") {
      if (result.order_id) await ensureInvoice(result.order_id, null).catch(() => null);
      await notify(result.order_status === "shipped" ? "order_dispatched" : "order_delivered", {
        to: result.contact_email ?? null,
        orderNumber: result.order_number,
        trackingUrl: trackingUrl(awb),
      });
    } else if (result.order_status === "out_for_delivery") {
      await notify("tracking_update", { to: result.contact_email ?? null, orderNumber: result.order_number, note: "Your order is out for delivery today.", trackingUrl: trackingUrl(awb) });
    }
  }
  return NextResponse.json({ ok: true, result: result.result });
}
