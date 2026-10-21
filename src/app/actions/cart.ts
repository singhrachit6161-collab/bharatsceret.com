"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addLine, cartCount, setLine } from "@/lib/cart";
import { readCart, writeCart } from "@/lib/data/cart";
import { availableFrom } from "@/lib/data/catalog";
import type { ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const lineInput = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(0).max(100),
});

async function loadVariant(variantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id, is_active, max_per_order, inventory (on_hand, reserved), products!inner (status)")
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return null;
  const product = data.products as unknown as { status: string };
  return {
    active: data.is_active && product.status === "active",
    maxPerOrder: data.max_per_order as number,
    available: availableFrom(data.inventory as never),
  };
}

export async function addToCart(input: { variantId: string; quantity: number }): Promise<ActionResult<{ count: number }>> {
  const parsed = lineInput.safeParse(input);
  if (!parsed.success || parsed.data.quantity < 1) return { ok: false, error: "Invalid item." };
  const variant = await loadVariant(parsed.data.variantId);
  if (!variant?.active) return { ok: false, error: "This item is no longer available." };

  const cart = await readCart();
  const current = cart.find((l) => l.variantId === parsed.data.variantId)?.quantity ?? 0;
  const desired = current + parsed.data.quantity;
  const limit = Math.min(variant.maxPerOrder, variant.available);
  if (limit <= 0) return { ok: false, error: "This item is out of stock." };
  if (desired > limit) {
    return {
      ok: false,
      error:
        current >= limit
          ? `You already have the maximum available quantity (${limit}) in your cart.`
          : `Only ${limit} can be ordered. You have ${current} in your cart.`,
    };
  }
  const next = addLine(cart, parsed.data.variantId, parsed.data.quantity);
  await writeCart(next);
  revalidatePath("/", "layout");
  return { ok: true, data: { count: cartCount(next) }, message: "Added to cart" };
}

export async function updateCartLine(input: { variantId: string; quantity: number }): Promise<ActionResult> {
  const parsed = lineInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quantity." };
  const cart = await readCart();
  if (parsed.data.quantity > 0) {
    const variant = await loadVariant(parsed.data.variantId);
    if (!variant?.active) return { ok: false, error: "This item is no longer available." };
    const limit = Math.min(variant.maxPerOrder, variant.available);
    if (parsed.data.quantity > limit) {
      return { ok: false, error: limit > 0 ? `Only ${limit} can be ordered.` : "This item is out of stock." };
    }
  }
  await writeCart(setLine(cart, parsed.data.variantId, parsed.data.quantity));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeCartLine(variantId: string): Promise<ActionResult> {
  return updateCartLine({ variantId, quantity: 0 });
}
