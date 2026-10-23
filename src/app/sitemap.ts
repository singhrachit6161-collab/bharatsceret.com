import type { MetadataRoute } from "next";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Generated at request time from the live catalogue.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const staticPages = ["", "/shop", "/deals", "/about", "/contact", "/faq", "/policies/shipping-policy", "/policies/returns-policy", "/policies/privacy-policy", "/policies/terms"].map((p) => ({
    url: `${base}${p}`,
  }));
  if (!isSupabaseConfigured()) return staticPages;
  const supabase = await createClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("slug, updated_at").eq("status", "active").limit(5000),
    supabase.from("categories").select("slug, updated_at").eq("is_visible", true),
  ]);
  return [
    ...staticPages,
    ...(categories ?? []).map((c) => ({ url: `${base}/category/${c.slug}`, lastModified: c.updated_at })),
    ...(products ?? []).map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updated_at })),
  ];
}
