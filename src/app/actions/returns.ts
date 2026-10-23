"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { RETURN_REASONS } from "@/lib/returns";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  orderId: z.uuid(),
  reason: z.enum(Object.keys(RETURN_REASONS) as [keyof typeof RETURN_REASONS, ...(keyof typeof RETURN_REASONS)[]]),
  details: z.string().trim().min(10, "Please describe the problem (at least 10 characters).").max(1000),
  items: z
    .array(z.object({ orderItemId: z.uuid(), quantity: z.number().int().min(1).max(100) }))
    .min(1, "Choose at least one item.")
    .max(50),
});

/** Customer return request. Eligibility (owner, delivered, window, quantities) is enforced by request_return(). */
export async function requestReturn(input: z.input<typeof schema>): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!rateLimit(`return:${user.id}`, 5, 60 * 60_000)) return { ok: false, error: "Too many requests. Please try again later." };
  const { orderId, reason, details, items } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_return", {
    p_order_id: orderId,
    p_reason: reason,
    p_details: details,
    p_items: items.map((i) => ({ order_item_id: i.orderItemId, quantity: i.quantity })),
  });
  if (error) return { ok: false, error: friendlyError(error) };

  const { data: order } = await supabase.from("orders").select("order_number, contact_email").eq("id", orderId).maybeSingle();
  if (order) {
    await notify("return_update", {
      to: order.contact_email,
      orderNumber: order.order_number,
      note: "We have received your return request. Our team will review it and get back to you.",
    });
    revalidatePath(`/account/orders/${encodeURIComponent(order.order_number)}`);
  }
  return { ok: true };
}
