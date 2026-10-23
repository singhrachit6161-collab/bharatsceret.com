import type { Metadata } from "next";
import { ProductGrid } from "@/components/store/ProductSection";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { listProducts } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Deals", alternates: { canonical: "/deals" } };

export default async function DealsPage() {
  const { items } = await listProducts({ pageSize: 48, sort: "popular", inStock: true });
  // A deal is a product whose current price is below a valid compare-at price.
  const deals = items
    .filter((p) => p.default_compare_at_paise !== null && p.default_price_paise !== null && Number(p.default_compare_at_paise) > Number(p.default_price_paise))
    .sort(
      (a, b) =>
        1 - Number(b.default_price_paise) / Number(b.default_compare_at_paise) -
        (1 - Number(a.default_price_paise) / Number(a.default_compare_at_paise)),
    );
  return (
    <div className="container-page pb-12">
      <Breadcrumbs items={[{ name: "Deals" }]} />
      <h1 className="section-title mb-2">Deals</h1>
      <p className="mb-6 text-sm text-muted">Products currently priced below their regular price.</p>
      {deals.length ? <ProductGrid products={deals} /> : <EmptyState title="No deals right now" description="Check back soon." actionHref="/shop" actionLabel="Shop all" />}
    </div>
  );
}
