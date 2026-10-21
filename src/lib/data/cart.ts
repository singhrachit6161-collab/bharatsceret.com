import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, parseCart, serializeCart, type CartLine } from "@/lib/cart";
import { isSupabaseConfigured } from "@/lib/env";
import type { PricedLine } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { availableFrom } from "./catalog";

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
  categoryIds: string[];
  issue: "unavailable" | "insufficient_stock" | "over_limit" | null;
}

export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

/** Only callable from Server Actions / Route Handlers. */
export async function writeCart(lines: CartLine[]) {
  const store = await cookies();
  store.set(CART_COOKIE, serializeCart(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Load authoritative product data for the cart lines; flags problems instead of hiding them. */
export async function getCartView(lines?: CartLine[]): Promise<CartViewLine[]> {
  const cart = lines ?? (await readCart());
  if (!cart.length || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select(
      `id, sku, label, price_paise, compare_at_paise, is_active, max_per_order,
       inventory (on_hand, reserved),
       products!inner (id, name, slug, status, published_at,
         product_images (url, sort_order),
         product_categories (category_id))`,
    )
    .in(
      "id",
      cart.map((l) => l.variantId),
    );

  type Row = {
    id: string;
    sku: string;
    label: string;
    price_paise: number;
    compare_at_paise: number | null;
    is_active: boolean;
    max_per_order: number;
    inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null;
    products: {
      id: string;
      name: string;
      slug: string;
      status: string;
      published_at: string | null;
      product_images: { url: string; sort_order: number }[];
      product_categories: { category_id: string }[];
    };
  };
  const byId = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.id, r]));

  const view: CartViewLine[] = [];
  for (const line of cart) {
    const r = byId.get(line.variantId);
    if (!r) continue; // Unknown or unpublished variant: silently dropped from the view.
    const available = availableFrom(r.inventory);
    const image = [...(r.products.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    let issue: CartViewLine["issue"] = null;
    if (!r.is_active || r.products.status !== "active") issue = "unavailable";
    else if (line.quantity > r.max_per_order) issue = "over_limit";
    else if (line.quantity > available) issue = available === 0 ? "unavailable" : "insufficient_stock";
    view.push({
      variantId: r.id,
      productId: r.products.id,
      slug: r.products.slug,
      name: r.products.name,
      label: r.label,
      sku: r.sku,
      imageUrl: image?.url ?? null,
      unitPricePaise: Number(r.price_paise),
      compareAtPaise: r.compare_at_paise === null ? null : Number(r.compare_at_paise),
      quantity: line.quantity,
      available,
      maxPerOrder: r.max_per_order,
      categoryIds: (r.products.product_categories ?? []).map((c) => c.category_id),
      issue,
    });
  }
  return view;
}

export function toPricedLines(view: CartViewLine[]): PricedLine[] {
  return view.map((l) => ({
    variantId: l.variantId,
    productId: l.productId,
    categoryIds: l.categoryIds,
    unitPricePaise: l.unitPricePaise,
    quantity: l.quantity,
  }));
}
