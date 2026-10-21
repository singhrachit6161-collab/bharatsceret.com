import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Banner, Category, HomepageSection, ProductDetail, ProductListing, Review, Variant } from "@/lib/types";

const LISTING_COLUMNS =
  "id, name, slug, short_description, brand, published_at, created_at, rating_avg, review_count, image_url, image_alt, variant_count, min_price_paise, max_price_paise, in_stock, pack_labels, default_variant_id, default_variant_label, default_price_paise, default_compare_at_paise, default_available, default_max_per_order, category_slugs";

export const SORT_OPTIONS = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  popular: "Popularity",
  rating: "Customer rating",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

export interface ProductFilters {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  pack?: string;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

/** Strip characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(q: string): string {
  return q
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, description, image_url, sort_order, is_visible, show_in_nav, seo_title, seo_description")
    .eq("is_visible", true)
    .order("sort_order");
  return (data ?? []) as Category[];
});

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  const all = await getCategories();
  return all.find((c) => c.slug === slug) ?? null;
});

export async function listProducts(f: ProductFilters): Promise<{ items: ProductListing[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(f.pageSize ?? 24, 1), 48);
  const page = Math.max(f.page ?? 1, 1);
  let query = supabase.from("product_listing").select(LISTING_COLUMNS, { count: "exact" }).gt("variant_count", 0);

  if (f.category) query = query.contains("category_slugs", [f.category]);
  if (f.q) {
    const q = sanitizeSearch(f.q);
    if (q) query = query.or(`name.ilike.%${q}%,short_description.ilike.%${q}%`);
  }
  if (f.minPrice !== undefined) query = query.gte("min_price_paise", f.minPrice);
  if (f.maxPrice !== undefined) query = query.lte("min_price_paise", f.maxPrice);
  if (f.inStock) query = query.eq("in_stock", true);
  if (f.pack) query = query.contains("pack_labels", [f.pack]);

  switch (f.sort) {
    case "newest":
      query = query.order("published_at", { ascending: false, nullsFirst: false });
      break;
    case "price_asc":
      query = query.order("min_price_paise", { ascending: true });
      break;
    case "price_desc":
      query = query.order("min_price_paise", { ascending: false });
      break;
    case "popular":
      query = query.order("popularity_score", { ascending: false });
      break;
    case "rating":
      query = query.order("rating_avg", { ascending: false, nullsFirst: false }).order("review_count", { ascending: false });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("featured_rank").order("in_stock", { ascending: false });
  }
  query = query.order("name").range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error("Could not load products");
  return { items: (data ?? []) as unknown as ProductListing[], total: count ?? 0 };
}

export async function getPackSizes(category?: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let q = supabase.from("product_listing").select("pack_labels").gt("variant_count", 0);
  if (category) q = q.contains("category_slugs", [category]);
  const { data } = await q;
  const set = new Set<string>();
  for (const row of data ?? []) for (const l of (row.pack_labels as string[] | null) ?? []) set.add(l);
  const grams = (s: string) => {
    const m = s.match(/([\d.]+)\s*(kg|g)/i);
    return m ? Number(m[1]) * (m[2].toLowerCase() === "kg" ? 1000 : 1) : Number.MAX_SAFE_INTEGER;
  };
  return [...set].sort((a, b) => grams(a) - grams(b));
}

async function listingsByIds(ids: string[]): Promise<ProductListing[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("product_listing").select(LISTING_COLUMNS).in("id", ids).gt("variant_count", 0);
  const byId = new Map(((data ?? []) as unknown as ProductListing[]).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductListing => Boolean(p));
}

export interface HomepageData {
  sections: HomepageSection[];
  hero: Banner[];
  tiles: Banner[];
  promos: Banner[];
  bestsellers: ProductListing[];
  mostViewed: ProductListing[];
  latest: ProductListing[];
  featured: ProductListing[];
}

export async function getHomepageData(): Promise<HomepageData> {
  const empty: HomepageData = {
    sections: [], hero: [], tiles: [], promos: [], bestsellers: [], mostViewed: [], latest: [], featured: [],
  };
  if (!isSupabaseConfigured()) return empty;
  const supabase = await createClient();

  const [sectionsRes, bannersRes] = await Promise.all([
    supabase.from("homepage_sections").select("key, title, is_visible, sort_order, item_limit").order("sort_order"),
    supabase
      .from("homepage_banners")
      .select("id, placement, title, subtitle, cta_label, link_url, image_url, mobile_image_url, alt, theme, sort_order")
      .order("sort_order"),
  ]);
  const sections = (sectionsRes.data ?? []) as HomepageSection[];
  const limit = (key: HomepageSection["key"]) => sections.find((s) => s.key === key)?.item_limit ?? 8;
  const banners = (bannersRes.data ?? []) as Banner[];

  const [bestFlagged, latest, featured, viewedIds] = await Promise.all([
    supabase
      .from("product_listing")
      .select(LISTING_COLUMNS)
      .eq("is_bestseller", true)
      .gt("variant_count", 0)
      .order("bestseller_rank")
      .limit(limit("bestsellers")),
    supabase
      .from("product_listing")
      .select(LISTING_COLUMNS)
      .gt("variant_count", 0)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit("latest")),
    supabase
      .from("product_listing")
      .select(LISTING_COLUMNS)
      .eq("is_featured", true)
      .gt("variant_count", 0)
      .order("featured_rank")
      .limit(limit("featured")),
    supabase.rpc("most_viewed_product_ids", { p_days: 30, p_limit: limit("most_viewed") }),
  ]);

  // Bestsellers: curated by admins; if none are flagged, use real sales data.
  let bestsellers = (bestFlagged.data ?? []) as unknown as ProductListing[];
  if (!bestsellers.length) {
    const { data } = await supabase.rpc("bestselling_product_ids", { p_days: 90, p_limit: limit("bestsellers") });
    bestsellers = await listingsByIds(((data ?? []) as { product_id: string }[]).map((r) => r.product_id));
  }
  const mostViewed = await listingsByIds(((viewedIds.data ?? []) as { product_id: string }[]).map((r) => r.product_id));

  return {
    sections,
    hero: banners.filter((b) => b.placement === "hero"),
    tiles: banners.filter((b) => b.placement === "category_tile").slice(0, limit("category_tiles")),
    promos: banners.filter((b) => b.placement === "promo").slice(0, limit("promo_banners")),
    bestsellers,
    mostViewed,
    latest: (latest.data ?? []) as unknown as ProductListing[],
    featured: (featured.data ?? []) as unknown as ProductListing[],
  };
}

type RawVariant = Omit<Variant, "available"> & {
  inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null;
};

export function availableFrom(inv: RawVariant["inventory"]): number {
  const row = Array.isArray(inv) ? inv[0] : inv;
  return row ? Math.max(0, row.on_hand - row.reserved) : 0;
}

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      `id, name, slug, brand, short_description, description, ingredients, storage_instructions, allergen_info,
       shelf_life, country_of_origin, manufacturer_info, fssai_license, seo_title, seo_description, og_image_url,
       rating_avg, review_count, status,
       product_images (id, url, alt, sort_order, storage_path),
       product_variants (id, sku, label, weight_grams, price_paise, compare_at_paise, is_active, sort_order, max_per_order,
         inventory (on_hand, reserved)),
       product_categories (categories (id, name, slug))`,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;

  const variants = ((data.product_variants ?? []) as RawVariant[])
    .filter((v) => v.is_active)
    .map(({ inventory, ...v }) => ({ ...v, available: availableFrom(inventory) }))
    .sort((a, b) => a.sort_order - b.sort_order || a.price_paise - b.price_paise);
  const images = ((data.product_images ?? []) as ProductDetail["images"]).sort((a, b) => a.sort_order - b.sort_order);
  const categories = ((data.product_categories ?? []) as unknown as { categories: ProductDetail["categories"][number] | null }[])
    .map((pc) => pc.categories)
    .filter((c): c is ProductDetail["categories"][number] => Boolean(c));

  return { ...(data as unknown as ProductDetail), variants, images, categories };
});

export async function getRelatedProducts(product: ProductDetail, limit = 8): Promise<ProductListing[]> {
  const slug = product.categories[0]?.slug;
  if (!slug) return [];
  const { items } = await listProducts({ category: slug, pageSize: limit + 1, sort: "popular" });
  return items.filter((p) => p.id !== product.id).slice(0, limit);
}

export async function getApprovedReviews(productId: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_reviews")
    .select("id, author_name, rating, title, body, is_verified_purchase, created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Review[];
}

export async function searchSuggestions(q: string): Promise<{ name: string; slug: string; image_url: string | null }[]> {
  const term = sanitizeSearch(q);
  if (term.length < 2 || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_listing")
    .select("name, slug, image_url")
    .ilike("name", `%${term}%`)
    .gt("variant_count", 0)
    .order("popularity_score", { ascending: false })
    .limit(6);
  return (data ?? []) as { name: string; slug: string; image_url: string | null }[];
}

export async function getListingsByIds(ids: string[]) {
  if (!isSupabaseConfigured()) return [];
  return listingsByIds(ids);
}
