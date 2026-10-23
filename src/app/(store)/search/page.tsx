import type { Metadata } from "next";
import { parseFilters, ProductListingPage } from "@/components/store/ProductListingPage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getCategories } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const categories = await getCategories();
  const filters = parseFilters(sp);
  return (
    <div className="container-page pb-12">
      <Breadcrumbs items={[{ name: "Search" }]} />
      <h1 className="section-title mb-6">{filters.q ? <>Results for &ldquo;{filters.q}&rdquo;</> : "Search products"}</h1>
      <ProductListingPage basePath="/search" searchParams={sp} filters={filters} categories={categories} />
    </div>
  );
}
