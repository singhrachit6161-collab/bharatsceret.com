import "server-only";
import { cache } from "react";
import { ancestorsOf } from "@/lib/category-tree";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { availableFrom, getCategories } from "./catalog";
import { getSettings } from "./settings";

export interface HamperBox {
  variantId: string;
  productId: string;
  name: string;
  description: string | null;
  label: string;
  capacity: number;
  pricePaise: number;
  available: number;
  imageUrl: string | null;
}

export interface HamperItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  label: string;
  pricePaise: number;
  available: number;
  maxPerOrder: number;
  imageUrl: string | null;
  /** Top-level collection used for the builder's tabs. */
  collection: string;
}

type InventoryRel = { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null;

const firstImage = (imgs: { url: string; sort_order: number }[] | null) =>
  [...(imgs ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;

export const getHamperBoxes = cache(async (): Promise<HamperBox[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id, label, price_paise, hamper_capacity, is_active, inventory (on_hand, reserved), products!inner (id, name, short_description, status, product_images (url, sort_order))")
    .not("hamper_capacity", "is", null)
    .eq("is_active", true)
    .order("hamper_capacity");
  type Row = {
    id: string; label: string; price_paise: number; hamper_capacity: number; inventory: InventoryRel;
    products: { id: string; name: string; short_description: string | null; status: string; product_images: { url: string; sort_order: number }[] };
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.products.status === "active")
    .map((r) => ({
      variantId: r.id,
      productId: r.products.id,
      name: r.products.name,
      description: r.products.short_description,
      label: r.label,
      capacity: r.hamper_capacity,
      pricePaise: Number(r.price_paise),
      available: availableFrom(r.inventory),
      imageUrl: firstImage(r.products.product_images),
    }));
});

/** Category ids eligible for hampers (configured roots plus all their descendants). */
function eligibleIds(categories: Category[], slugs: string[]): Set<string> {
  const roots = new Set(categories.filter((c) => slugs.includes(c.slug)).map((c) => c.id));
  return new Set(categories.filter((c) => roots.has(c.id) || ancestorsOf(c.id, categories).some((a) => roots.has(a.id))).map((c) => c.id));
}

export const getHamperItems = cache(async (): Promise<HamperItem[]> => {
  if (!isSupabaseConfigured()) return [];
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const eligible = eligibleIds(categories, settings.hamper.eligible_category_slugs);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id, label, price_paise, max_per_order, sort_order, inventory (on_hand, reserved), products!inner (id, slug, name, status, published_at, product_images (url, sort_order), product_categories (category_id))")
    .is("hamper_capacity", null)
    .eq("is_active", true)
    .eq("products.status", "active")
    .limit(1000);
  type Row = {
    id: string; label: string; price_paise: number; max_per_order: number; sort_order: number; inventory: InventoryRel;
    products: {
      id: string; slug: string; name: string; status: string; published_at: string | null;
      product_images: { url: string; sort_order: number }[]; product_categories: { category_id: string }[];
    };
  };
  const now = Date.now();
  const items: HamperItem[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    if (r.products.published_at && new Date(r.products.published_at).getTime() > now) continue;
    const direct = (r.products.product_categories ?? []).map((c) => c.category_id);
    const typeCategory = direct.find((id) => eligible.has(id));
    if (!typeCategory) continue;
    const root = [...ancestorsOf(typeCategory, categories), byId.get(typeCategory)!].find((c) => !c.parent_id);
    items.push({
      variantId: r.id,
      productId: r.products.id,
      slug: r.products.slug,
      name: r.products.name,
      label: r.label,
      pricePaise: Number(r.price_paise),
      available: availableFrom(r.inventory),
      maxPerOrder: r.max_per_order,
      imageUrl: firstImage(r.products.product_images),
      collection: root?.name ?? "More",
    });
  }
  return items.sort((a, b) => a.collection.localeCompare(b.collection) || a.name.localeCompare(b.name) || a.pricePaise - b.pricePaise);
});
