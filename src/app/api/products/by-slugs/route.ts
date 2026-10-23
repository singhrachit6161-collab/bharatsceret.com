import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const LISTING =
  "id, name, slug, short_description, brand, published_at, created_at, rating_avg, review_count, image_url, image_alt, variant_count, min_price_paise, max_price_paise, in_stock, pack_labels, default_variant_id, default_variant_label, default_price_paise, default_compare_at_paise, default_available, default_max_per_order, category_slugs";

export async function GET(request: NextRequest) {
  const slugs = (request.nextUrl.searchParams.get("slugs") ?? "")
    .split(",")
    .filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
    .slice(0, 12);
  if (!slugs.length || !isSupabaseConfigured()) return NextResponse.json({ items: [] });
  const supabase = await createClient();
  const { data } = await supabase.from("product_listing").select(LISTING).in("slug", slugs).gt("variant_count", 0);
  const bySlug = new Map((data ?? []).map((p) => [p.slug as string, p]));
  return NextResponse.json({ items: slugs.map((s) => bySlug.get(s)).filter(Boolean) });
}
