import type { Metadata } from "next";
import { parseFilters, ProductListingPage } from "@/components/store/ProductListingPage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getCategories } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Shop all dry fruits",
  description: "Browse almonds, cashews, walnuts, pistachios, raisins, dates, seeds, trail mixes and gift hampers.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const categories = await getCategories();
  return (
    <div className="container-page pb-12">
      <Breadcrumbs items={[{ name: "Shop" }]} />
      <h1 className="section-title mb-6">All products</h1>
      <ProductListingPage basePath="/shop" searchParams={sp} filters={parseFilters(sp)} categories={categories} />
    </div>
  );
}
