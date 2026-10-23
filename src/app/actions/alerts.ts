"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type StockAlertResult = { ok: true; message: string } | { ok: false; error: string; signIn?: boolean };

/** Ask to be emailed when a sold-out pack size is back. The email comes from the signed-in account. */
export async function subscribeStockAlert(variantId: string): Promise<StockAlertResult> {
  if (!z.uuid().safeParse(variantId).success) return { ok: false, error: "Invalid request." };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to get stock alerts.", signIn: true };
  if (!rateLimit(`stock-alert:${user.id}`, 20, 60 * 60_000)) return { ok: false, error: "Too many requests. Please try again later." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscribe_stock_alert", { p_variant_id: variantId });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, message: data === "already_subscribed" ? "You're already on the list for this pack." : "Done! We'll email you when it's back in stock." };
}
