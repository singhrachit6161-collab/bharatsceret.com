import "server-only";
import { publicEnv } from "@/lib/env";
import { notify } from "@/lib/notifications";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Email customers whose sold-out pack is purchasable again. An alert is marked
 * as notified only after the email provider accepts the message; with no
 * provider configured, alerts wait until one is.
 */
export async function sendStockAlerts(limit = 200): Promise<{ sent: number; pending: number; skipped?: string }> {
  if (!serverEnv.emailProviderApiKey || !serverEnv.emailFrom) return { sent: 0, pending: 0, skipped: "email provider not configured" };
  const db = createServiceClient();
  const { data, error } = await db.rpc("ready_stock_alerts", { p_limit: limit });
  if (error || !data) return { sent: 0, pending: 0, skipped: "query failed" };
  const rows = data as { alert_id: string; email: string; product_name: string; product_slug: string; variant_label: string }[];
  const sent: string[] = [];
  for (const r of rows) {
    const res = await notify("back_in_stock", {
      to: r.email,
      productName: `${r.product_name} (${r.variant_label})`,
      productUrl: `${publicEnv.siteUrl}/product/${encodeURIComponent(r.product_slug)}`,
      note: "Quantities can be limited, so we can't hold stock for you.",
    });
    if (res.sent) sent.push(r.alert_id);
  }
  if (sent.length) await db.from("stock_alerts").update({ notified_at: new Date().toISOString() }).in("id", sent);
  return { sent: sent.length, pending: rows.length - sent.length };
}
