"use client";

import { useEffect, useState } from "react";
import type { ProductListing } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { ProductRail, RailItem } from "./ProductRail";

export function RecentlyViewed({ excludeSlug }: { excludeSlug?: string }) {
  const [items, setItems] = useState<ProductListing[]>([]);
  useEffect(() => {
    let slugs: string[] = [];
    try {
      slugs = (JSON.parse(localStorage.getItem("sv_recently_viewed") ?? "[]") as string[]).filter((s) => s !== excludeSlug).slice(0, 10);
    } catch {
      return;
    }
    if (!slugs.length) return;
    const ctrl = new AbortController();
    fetch(`/api/products/by-slugs?slugs=${encodeURIComponent(slugs.join(","))}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [excludeSlug]);

  if (!items.length) return null;
  return (
    <section aria-labelledby="recently-viewed" className="mt-12">
      <h2 id="recently-viewed" className="section-title mb-5">
        Recently viewed
      </h2>
      <ProductRail label="Recently viewed">
        {items.map((p) => (
          <RailItem key={p.id}>
            <ProductCard product={p} />
          </RailItem>
        ))}
      </ProductRail>
    </section>
  );
}
