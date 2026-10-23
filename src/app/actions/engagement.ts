"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isServiceRoleConfigured } from "@/lib/server-env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { contactSchema, fieldErrors, newsletterSchema, reviewSchema } from "@/lib/validation";

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string> } | null;

export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newsletterSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  if (!rateLimit(`newsletter:${await clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, message: "Too many attempts. Please try again later." };
  }
  if (!isServiceRoleConfigured()) return { ok: false, message: "Newsletter sign-up is not available yet." };
  // Service role: subscribers are not readable/writable by clients (prevents list scraping).
  const { error } = await createServiceClient()
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data.email.toLowerCase(), status: "subscribed" }, { onConflict: "email" });
  if (error) return { ok: false, message: "Could not subscribe right now. Please try again." };
  return { ok: true, message: "Thank you for subscribing!" };
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  if (!rateLimit(`contact:${await clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, message: "Too many messages. Please try again later." };
  }
  const user = await getSessionUser();
  const supabase = await createClient();
  const { error } = await supabase.from("support_requests").insert({
    ...parsed.data,
    phone: parsed.data.phone ?? null,
    user_id: user?.id ?? null,
  });
  if (error) return { ok: false, message: "Could not send your message. Please try again." };
  return { ok: true, message: "Thanks! Our team will get back to you soon." };
}

export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in to write a review." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  if (!rateLimit(`review:${user.id}`, 5, 60 * 60 * 1000)) return { ok: false, message: "Please try again later." };
  const supabase = await createClient();
  // status and verified-purchase are set by a database trigger, never by the client.
  const { error } = await supabase.from("product_reviews").insert({ ...parsed.data, user_id: user.id });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "You have already reviewed this product." : "Could not submit your review.",
    };
  }
  return { ok: true, message: "Thank you! Your review will appear after moderation." };
}

export async function toggleWishlist(productId: string): Promise<ActionResult<{ saved: boolean }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to use your wishlist." };
  if (!z.uuid().safeParse(productId).success) return { ok: false, error: "Invalid product." };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) {
    await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  } else {
    const { error } = await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
    if (error) return { ok: false, error: "Could not update wishlist." };
  }
  revalidatePath("/account/wishlist");
  return { ok: true, data: { saved: !existing } };
}
