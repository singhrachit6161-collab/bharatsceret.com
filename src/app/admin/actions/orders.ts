"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext, audit, denied, formString, type AdminFormState } from "@/lib/admin";
import { ADMIN_ROLES } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { rupeesToPaise } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { getRazorpay } from "@/lib/razorpay";
import { isRazorpayConfigured, isServiceRoleConfigured } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const FULFILMENT = ["processing", "packed", "shipped", "out_for_delivery", "delivered", "confirmed"] as const;

async function orderContact(db: Awaited<ReturnType<typeof adminContext>>["db"], orderId: string) {
  const { data } = await db.from("orders").select("order_number, contact_email, total_paise").eq("id", orderId).maybeSingle();
  return data as { order_number: string; contact_email: string | null; total_paise: number } | null;
}

export async function updateOrderStatus(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db } = await adminContext();
    const orderId = formString(fd, "order_id");
    const to = z.enum(FULFILMENT).safeParse(formString(fd, "status"));
    if (!uuid.safeParse(orderId).success || !to.success) return { ok: false, message: "Invalid request." };
    const { error } = await db.rpc("update_order_status", { p_order_id: orderId, p_to: to.data, p_note: formString(fd, "note") || null });
    if (error) return { ok: false, message: friendlyError(error) };
    const c = await orderContact(db, orderId);
    if (c && (to.data === "shipped" || to.data === "delivered")) {
      await notify(to.data === "shipped" ? "order_dispatched" : "order_delivered", { to: c.contact_email, orderNumber: c.order_number });
    }
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return denied(e);
  }
}

export async function adminCancelOrder(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db } = await adminContext();
    const orderId = formString(fd, "order_id");
    const reason = formString(fd, "reason");
    if (!uuid.safeParse(orderId).success) return { ok: false, message: "Invalid request." };
    if (formString(fd, "confirm") !== "CANCEL") return { ok: false, message: 'Type CANCEL to confirm.' };
    const { data, error } = await db.rpc("cancel_order", { p_order_id: orderId, p_reason: reason });
    if (error) return { ok: false, message: friendlyError(error) };
    const c = await orderContact(db, orderId);
    if (c) await notify("order_cancelled", { to: c.contact_email, orderNumber: c.order_number, note: reason });
    revalidatePath(`/admin/orders/${orderId}`);
    return {
      ok: true,
      message: data === "cancelled_refund_required" ? "Order cancelled and stock restored. A refund is now required." : "Order cancelled and stock restored.",
    };
  } catch (e) {
    return denied(e);
  }
}

const shipmentSchema = z.object({
  order_id: z.uuid(),
  shipment_id: z.union([z.uuid(), z.literal("")]),
  carrier: z.string().trim().min(2).max(80),
  tracking_number: z.string().trim().max(80).optional().transform((v) => v || null),
  tracking_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\//.test(v), "Tracking URL must start with https://"),
  status: z.enum(["pending", "packed", "shipped", "in_transit", "out_for_delivery", "delivered", "rto", "cancelled"]),
  location: z.string().trim().max(120).optional().transform((v) => v || null),
  note: z.string().trim().max(300).optional().transform((v) => v || null),
});

export async function saveShipment(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext();
    const parsed = shipmentSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const s = parsed.data;
    const now = new Date().toISOString();
    const row = {
      order_id: s.order_id,
      carrier: s.carrier,
      tracking_number: s.tracking_number,
      tracking_url: s.tracking_url,
      status: s.status,
      ...(["shipped", "in_transit", "out_for_delivery", "delivered"].includes(s.status) ? { shipped_at: now } : {}),
      ...(s.status === "delivered" ? { delivered_at: now } : {}),
    };
    const res = s.shipment_id
      ? await db.from("shipments").update(row).eq("id", s.shipment_id).eq("order_id", s.order_id).select("id, shipped_at").single()
      : await db.from("shipments").insert(row).select("id, shipped_at").single();
    if (res.error) return { ok: false, message: res.error.code === "23505" ? "That tracking number is already used." : "Could not save shipment." };

    await db.from("shipment_events").insert({
      shipment_id: res.data.id,
      status: s.status,
      description: s.note,
      location: s.location,
      source: "manual",
      actor_id: user.id,
    });
    await audit(db, user.id, "shipment.save", "order", s.order_id, { status: s.status, carrier: s.carrier, tracking_number: s.tracking_number });

    // Keep the order status in step with the shipment where the transition is valid.
    const { data: order } = await db.from("orders").select("status").eq("id", s.order_id).single();
    const target =
      s.status === "shipped" || s.status === "in_transit" ? "shipped" : s.status === "out_for_delivery" ? "out_for_delivery" : s.status === "delivered" ? "delivered" : s.status === "packed" ? "packed" : null;
    if (order && target) {
      for (const st of fulfilmentPath(order.status as string, target)) {
        const { error } = await db.rpc("update_order_status", { p_order_id: s.order_id, p_to: st, p_note: `Shipment ${s.status}` });
        if (error) break;
      }
    }
    const c = await orderContact(db, s.order_id);
    if (c) {
      const kind = s.status === "shipped" ? "order_dispatched" : s.status === "delivered" ? "order_delivered" : "tracking_update";
      await notify(kind, { to: c.contact_email, orderNumber: c.order_number, trackingUrl: s.tracking_url });
    }
    revalidatePath(`/admin/orders/${s.order_id}`);
    return { ok: true, message: "Shipment saved." };
  } catch (e) {
    return denied(e);
  }
}

/** Forward order transitions needed to reach `target` (matches update_order_status rules). */
function fulfilmentPath(current: string, target: string): string[] {
  const chain = ["packed", "shipped", "out_for_delivery", "delivered"];
  let from: number;
  if (current === "confirmed" || current === "processing") from = -1;
  else if (chain.includes(current)) from = chain.indexOf(current);
  else return []; // cancelled, on_hold, etc.: never move automatically
  const to = chain.indexOf(target);
  if (to <= from) return [];
  if (current === "shipped" && target === "delivered") return ["delivered"];
  return chain.slice(from + 1, to + 1);
}

export async function markCodCollected(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db } = await adminContext(ADMIN_ROLES);
    const orderId = formString(fd, "order_id");
    const note = formString(fd, "note");
    if (!uuid.safeParse(orderId).success || note.length < 3) return { ok: false, message: "Add a note (e.g. courier remittance reference)." };
    const { error } = await db.rpc("mark_cod_collected", { p_order_id: orderId, p_note: note });
    if (error) return { ok: false, message: friendlyError(error) };
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Marked as COD collected." };
  } catch (e) {
    return denied(e);
  }
}

export async function restockReturn(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db } = await adminContext();
    const orderId = formString(fd, "order_id");
    const { error } = await db.rpc("restock_returned_order", { p_order_id: orderId, p_note: formString(fd, "note") });
    if (error) return { ok: false, message: friendlyError(error) };
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Returned stock added back to inventory." };
  } catch (e) {
    return denied(e);
  }
}

/**
 * Refunds: owner/admin only, explicit confirmation, idempotency key per form
 * render. The refund is recorded as pending first, then sent to Razorpay; it
 * is only marked processed when Razorpay reports it processed (API response
 * or verified webhook).
 */
export async function initiateRefund(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { user } = await adminContext(ADMIN_ROLES);
    if (!isRazorpayConfigured() || !isServiceRoleConfigured()) return { ok: false, message: "Razorpay is not configured." };
    const orderId = formString(fd, "order_id");
    const amount = rupeesToPaise(formString(fd, "amount"));
    const reason = formString(fd, "reason");
    const key = formString(fd, "idempotency_key");
    if (!uuid.safeParse(orderId).success || !/^[A-Za-z0-9-]{8,100}$/.test(key)) return { ok: false, message: "Invalid request." };
    if (!amount || amount <= 0) return { ok: false, message: "Enter a valid refund amount." };
    if (reason.length < 3) return { ok: false, message: "A reason is required." };
    if (formString(fd, "confirm") !== "REFUND") return { ok: false, message: "Type REFUND to confirm." };

    const service = createServiceClient();
    const { data, error } = await service.rpc("create_refund_request", {
      p_order_id: orderId,
      p_amount_paise: amount,
      p_reason: reason,
      p_actor: user.id,
      p_idempotency_key: `refund:${key}`,
    });
    if (error || !data?.[0]) return { ok: false, message: friendlyError(error) };
    const req = data[0] as { refund_id: string; provider_payment_id: string; created: boolean };
    if (!req.created) return { ok: true, message: "This refund was already submitted." };

    try {
      const refund = await getRazorpay().payments.refund(req.provider_payment_id, {
        amount,
        speed: "normal",
        notes: { refund_request_id: req.refund_id, order_id: orderId },
        receipt: req.refund_id.slice(0, 40),
      });
      const status = refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending";
      await service.rpc("sync_refund", {
        p_refund_request_id: req.refund_id,
        p_provider_payment_id: req.provider_payment_id,
        p_provider_refund_id: refund.id,
        p_amount_paise: Number(refund.amount),
        p_status: status,
        p_failure_reason: status === "failed" ? "Gateway reported failure" : null,
      });
      const { data: o } = await service.from("orders").select("order_number, contact_email").eq("id", orderId).single();
      if (o) await notify("refund_update", { to: o.contact_email, orderNumber: o.order_number, note: `Refund of ₹${(amount / 100).toFixed(2)} ${status === "processed" ? "processed" : "initiated"}.` });
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: true, message: status === "processed" ? "Refund processed." : "Refund initiated; status will update when Razorpay confirms it." };
    } catch (e) {
      const msg = (e as { error?: { description?: string } })?.error?.description ?? "Gateway error";
      await service.from("refunds").update({ status: "failed", failure_reason: msg.slice(0, 300) }).eq("id", req.refund_id).eq("status", "pending");
      await service.from("audit_logs").insert({ actor_id: user.id, action: "refund.failed", entity_type: "order", entity_id: orderId, details: { refund_id: req.refund_id, error: msg.slice(0, 300) } });
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: false, message: `Razorpay rejected the refund: ${msg}` };
    }
  } catch (e) {
    return denied(e);
  }
}
