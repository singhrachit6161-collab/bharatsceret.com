import "server-only";
import { cookies } from "next/headers";
import { aggregateCart, CART_COOKIE, fitsInCookie, parseCart, serializeCart, type CartState } from "@/lib/cart";
import { withAncestorIds } from "@/lib/category-tree";
import { isSupabaseConfigured } from "@/lib/env";
import type { PricedLine } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { availableFrom, getCategories } from "./catalog";

export type LineIssue = "unavailable" | "insufficient_stock" | "over_limit" | null;

export interface CartViewLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  label: string;
  sku: string;
  imageUrl: string | null;
  unitPricePaise: number;
  compareAtPaise: number | null;
  quantity: number;
  available: number;
  maxPerOrder: number;
  hamperCapacity: number | null;
  categoryIds: string[];
  /** Problem with this variant considering the WHOLE cart (standalone + hampers). */
  issue: LineIssue;
}

export interface CartViewBundle {
  id: string;
  box: CartViewLine;
  items: CartViewLine[];
  capacity: number;
  units: number;
  recipient: string | null;
  message: string | null;
  subtotalPaise: number;
  issue: string | null;
}

export interface CartView {
  /** Standalone lines. */
  lines: CartViewLine[];
  bundles: CartViewBundle[];
  /** Per-variant totals across the cart: what is priced, stock-checked and ordered. */
  priced: PricedLine[];
  /** Bundle payload for place_order. */
  bundlePayload: { box_variant_id: string; contents: { variant_id: string; quantity: number }[]; recipient_name: string | null; gift_message: string | null }[];
  hasIssues: boolean;
  isEmpty: boolean;
}

export const EMPTY_VIEW: CartView = { lines: [], bundles: [], priced: [], bundlePayload: [], hasIssues: false, isEmpty: true };

export class CartFullError extends Error {
  constructor() {
    super("Your bag is full. Please check out or remove something first.");
  }
}

export async function readCart(): Promise<CartState> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

/** Only callable from Server Actions / Route Handlers. Throws CartFullError if the cookie would be too large. */
export async function writeCart(state: CartState) {
  if (!fitsInCookie(state)) throw new CartFullError();
  const store = await cookies();
  store.set(CART_COOKIE, serializeCart(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

type Row = {
  id: string;
  sku: string;
  label: string;
  price_paise: number;
  compare_at_paise: number | null;
  is_active: boolean;
  max_per_order: number;
  hamper_capacity: number | null;
  inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null;
  products: {
    id: string;
    name: string;
    slug: string;
    status: string;
    product_images: { url: string; sort_order: number }[];
    product_categories: { category_id: string }[];
  };
};

/** Load authoritative product data for the cart; flags problems instead of hiding them. */
export async function getCartView(state?: CartState): Promise<CartView> {
  const cart = state ?? (await readCart());
  const aggregate = aggregateCart(cart);
  if (!aggregate.length || !isSupabaseConfigured()) return EMPTY_VIEW;

  const supabase = await createClient();
  const [{ data }, allCategories] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        `id, sku, label, price_paise, compare_at_paise, is_active, max_per_order, hamper_capacity,
         inventory (on_hand, reserved),
         products!inner (id, name, slug, status,
           product_images (url, sort_order),
           product_categories (category_id))`,
      )
      .in(
        "id",
        aggregate.map((l) => l.variantId),
      ),
    getCategories(),
  ]);
  const rows = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.id, r]));
  // Drop entries whose variants no longer exist (or standalone boxes), then
  // total ONLY what remains, so nothing invisible is ever priced or ordered.
  const kept: CartState = {
    lines: cart.lines.filter((l) => rows.has(l.variantId) && rows.get(l.variantId)!.hamper_capacity === null),
    bundles: cart.bundles.filter((b) => rows.get(b.boxVariantId)?.hamper_capacity),
  };
  const totals = new Map(aggregateCart(kept).map((l) => [l.variantId, l.quantity]));

  const viewLine = (variantId: string, quantity: number): CartViewLine | null => {
    const r = rows.get(variantId);
    if (!r) return null;
    const available = availableFrom(r.inventory);
    const total = totals.get(variantId) ?? quantity;
    let issue: LineIssue = null;
    if (!r.is_active || r.products.status !== "active") issue = "unavailable";
    else if (total > r.max_per_order) issue = "over_limit";
    else if (total > available) issue = available === 0 ? "unavailable" : "insufficient_stock";
    const image = [...(r.products.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      variantId: r.id,
      productId: r.products.id,
      slug: r.products.slug,
      name: r.products.name,
      label: r.label,
      sku: r.sku,
      imageUrl: image?.url ?? null,
      unitPricePaise: Number(r.price_paise),
      compareAtPaise: r.compare_at_paise === null ? null : Number(r.compare_at_paise),
      quantity,
      available,
      maxPerOrder: r.max_per_order,
      hamperCapacity: r.hamper_capacity,
      // Coupons scoped to a parent collection (e.g. Dry Fruits) apply to its sub-collections.
      categoryIds: withAncestorIds((r.products.product_categories ?? []).map((c) => c.category_id), allCategories),
      issue,
    };
  };

  // Unknown or unpublished variants are silently dropped from the view.
  const lines = kept.lines.map((l) => viewLine(l.variantId, l.quantity)).filter((l): l is CartViewLine => l !== null);

  const bundles: CartViewBundle[] = [];
  for (const b of kept.bundles) {
    const box = viewLine(b.boxVariantId, 1)!;
    const items = b.items.map((l) => viewLine(l.variantId, l.quantity)).filter((l): l is CartViewLine => l !== null);
    const units = items.reduce((n, l) => n + l.quantity, 0);
    const capacity = box.hamperCapacity ?? 0;
    let issue: string | null = null;
    if (items.length !== b.items.length || items.some((i) => i.hamperCapacity !== null)) issue = "Some items in this hamper are no longer available.";
    else if (units > capacity) issue = `This box holds ${capacity} items.`;
    else if (box.issue) issue = "This box is out of stock.";
    else if (items.some((i) => i.issue)) issue = "Some items in this hamper are out of stock.";
    bundles.push({
      id: b.id,
      box,
      items,
      capacity,
      units,
      recipient: b.recipient,
      message: b.message,
      subtotalPaise: box.unitPricePaise + items.reduce((n, l) => n + l.unitPricePaise * l.quantity, 0),
      issue,
    });
  }

  // Price only what is actually shown (dropped/unknown variants are excluded).
  const shown = new Map<string, CartViewLine>();
  for (const l of lines) shown.set(l.variantId, l);
  for (const b of bundles) {
    shown.set(b.box.variantId, b.box);
    for (const l of b.items) shown.set(l.variantId, l);
  }
  const priced: PricedLine[] = [...shown.values()].map((l) => ({
    variantId: l.variantId,
    productId: l.productId,
    categoryIds: l.categoryIds,
    unitPricePaise: l.unitPricePaise,
    quantity: totals.get(l.variantId) ?? l.quantity,
  }));

  const hasIssues = lines.some((l) => l.issue) || bundles.some((b) => b.issue);

  return {
    lines,
    bundles,
    priced,
    bundlePayload: bundles.map((b) => ({
      box_variant_id: b.box.variantId,
      contents: b.items.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
      recipient_name: b.recipient,
      gift_message: b.message,
    })),
    hasIssues,
    isEmpty: lines.length === 0 && bundles.length === 0,
  };
}
