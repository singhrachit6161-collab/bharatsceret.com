"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addBundle, addLine, aggregateCart, cartCount, cleanText, MAX_BUNDLES, MAX_MESSAGE, MAX_RECIPIENT, newBundleId,
  removeBundle, setLine, type CartState,
} from "@/lib/cart";
import { CartFullError, readCart, writeCart } from "@/lib/data/cart";
import { availableFrom } from "@/lib/data/catalog";
import { getHamperBoxes, getHamperItems } from "@/lib/data/hamper";
import { getSettings } from "@/lib/data/settings";
import type { ActionResult } from "@/lib/errors";
import { validateHamper } from "@/lib/hamper";
import { createClient } from "@/lib/supabase/server";

const lineInput = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(0).max(100),
});

async function loadVariant(variantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id, is_active, max_per_order, hamper_capacity, inventory (on_hand, reserved), products!inner (status)")
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return null;
  const product = data.products as unknown as { status: string };
  return {
    // Hamper boxes are only sold inside a hamper.
    active: data.is_active && product.status === "active" && data.hamper_capacity === null,
    maxPerOrder: data.max_per_order as number,
    available: availableFrom(data.inventory as never),
  };
}

/** Units of a variant already used elsewhere in the cart (hampers, or standalone when editing a hamper). */
function usedElsewhere(cart: CartState, variantId: string, excludeStandalone: boolean): number {
  const total = aggregateCart(cart).find((l) => l.variantId === variantId)?.quantity ?? 0;
  const standalone = cart.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
  return excludeStandalone ? total - standalone : total;
}

async function save(next: CartState): Promise<ActionResult | null> {
  try {
    await writeCart(next);
  } catch (e) {
    if (e instanceof CartFullError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return null;
}

export async function addToCart(input: { variantId: string; quantity: number }): Promise<ActionResult<{ count: number }>> {
  const parsed = lineInput.safeParse(input);
  if (!parsed.success || parsed.data.quantity < 1) return { ok: false, error: "Invalid item." };
  const variant = await loadVariant(parsed.data.variantId);
  if (!variant?.active) return { ok: false, error: "This item is no longer available." };

  const cart = await readCart();
  const current = usedElsewhere(cart, parsed.data.variantId, false);
  const desired = current + parsed.data.quantity;
  const limit = Math.min(variant.maxPerOrder, variant.available);
  if (limit <= 0) return { ok: false, error: "This item is out of stock." };
  if (desired > limit) {
    return {
      ok: false,
      error:
        current >= limit
          ? `You already have the maximum available quantity (${limit}) in your bag, including hampers.`
          : `Only ${limit} can be ordered. You have ${current} in your bag.`,
    };
  }
  const next = addLine(cart, parsed.data.variantId, parsed.data.quantity);
  const failed = await save(next);
  if (failed) return failed as ActionResult<{ count: number }>;
  return { ok: true, data: { count: cartCount(next) }, message: "Added to cart" };
}

export async function updateCartLine(input: { variantId: string; quantity: number }): Promise<ActionResult> {
  const parsed = lineInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quantity." };
  const cart = await readCart();
  if (parsed.data.quantity > 0) {
    const variant = await loadVariant(parsed.data.variantId);
    if (!variant?.active) return { ok: false, error: "This item is no longer available." };
    const limit = Math.min(variant.maxPerOrder, variant.available) - usedElsewhere(cart, parsed.data.variantId, true);
    if (parsed.data.quantity > limit) {
      return { ok: false, error: limit > 0 ? `Only ${limit} more can be ordered (some are in your hampers).` : "This item is out of stock." };
    }
  }
  return (await save(setLine(cart, parsed.data.variantId, parsed.data.quantity))) ?? { ok: true };
}

export async function removeCartLine(variantId: string): Promise<ActionResult> {
  return updateCartLine({ variantId, quantity: 0 });
}

const hamperInput = z.object({
  boxVariantId: z.uuid(),
  items: z
    .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(24) }))
    .min(1)
    .max(24),
  recipient: z.string().max(MAX_RECIPIENT * 2).optional(),
  message: z.string().max(MAX_MESSAGE * 2).optional(),
});

/**
 * Validate a Build Your Own Hamper against live data and add it to the bag as
 * one bundle. Prices are never taken from the client.
 */
export async function addHamperToCart(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = hamperInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check your hamper and try again." };
  const settings = await getSettings();
  if (!settings.hamper.enabled) return { ok: false, error: "The hamper builder is not available right now." };

  const cart = await readCart();
  if (cart.bundles.length >= MAX_BUNDLES) return { ok: false, error: `You can have up to ${MAX_BUNDLES} custom hampers in one order.` };

  const [boxes, items] = await Promise.all([getHamperBoxes(), getHamperItems()]);
  const box = boxes.find((b) => b.variantId === parsed.data.boxVariantId);
  if (!box) return { ok: false, error: "Please choose a box." };
  if (box.available - usedElsewhere(cart, box.variantId, false) < 1) return { ok: false, error: `The ${box.name} is out of stock.` };

  const byId = new Map(items.map((i) => [i.variantId, i]));
  const problem = validateHamper(
    { capacity: box.capacity, minItems: settings.hamper.min_items },
    parsed.data.items.map((i) => {
      const item = byId.get(i.variantId);
      const used = usedElsewhere(cart, i.variantId, false);
      return {
        variantId: i.variantId,
        quantity: i.quantity,
        eligible: Boolean(item),
        available: item ? item.available - used : 0,
        maxPerOrder: item ? item.maxPerOrder - used : 0,
      };
    }),
  );
  if (problem) return { ok: false, error: problem };

  const messageMax = Math.min(MAX_MESSAGE, settings.hamper.message_max || MAX_MESSAGE);
  const next = addBundle(cart, {
    id: newBundleId(),
    boxVariantId: box.variantId,
    items: parsed.data.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    recipient: cleanText(parsed.data.recipient, MAX_RECIPIENT),
    message: cleanText(parsed.data.message, messageMax),
  });
  const failed = await save(next);
  if (failed) return failed as ActionResult<{ count: number }>;
  return { ok: true, data: { count: cartCount(next) }, message: "Hamper added to your bag" };
}

export async function removeHamper(id: string): Promise<ActionResult> {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return { ok: false, error: "Invalid hamper." };
  const cart = await readCart();
  return (await save(removeBundle(cart, id))) ?? { ok: true };
}
