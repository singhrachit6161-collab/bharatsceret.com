import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderDetail } from "@/lib/types";

export const ORDER_DETAIL_SELECT = `
  id, order_number, user_id, status, payment_method, payment_status, currency, subtotal_paise, discount_paise,
  shipping_paise, cod_fee_paise, total_paise, refunded_paise, coupon_code, shipping_address, contact_email,
  contact_phone, customer_note, reservation_expires_at, cancel_reason, paid_at, delivered_at, created_at,
  order_items (id, product_id, variant_id, product_name, variant_label, sku, image_url, unit_price_paise, quantity, line_total_paise),
  order_status_history (id, from_status, to_status, note, created_at),
  shipments (id, carrier, tracking_number, tracking_url, status, shipped_at, delivered_at,
    shipment_events (id, status, description, location, occurred_at))`;

/** RLS ensures customers only ever receive their own orders. */
export async function getOrderByNumber(orderNumber: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select(ORDER_DETAIL_SELECT).eq("order_number", orderNumber).maybeSingle();
  if (!data) return null;
  const o = data as unknown as OrderDetail;
  o.order_status_history.sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const s of o.shipments) s.shipment_events?.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  return o;
}
