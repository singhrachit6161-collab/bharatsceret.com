import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters, ProductListingPage } from "@/components/store/ProductListingPage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getCategories, getCategoryBySlug } from "@/lib/data/catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.seo_title || category.name,
    description: category.seo_description || category.description || `Shop ${category.name} online.`,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: { title: category.name, images: category.image_url ? [category.image_url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, categories] = await Promise.all([getCategoryBySlug(slug), getCategories()]);
  if (!category) notFound();
  return (
    <div className="container-page pb-12">
      <Breadcrumbs items={[{ name: "Shop", href: "/shop" }, { name: category.name }]} />
      <header className="mb-6">
        <h1 className="section-title">{category.name}</h1>
        {category.description && <p className="mt-2 max-w-2xl text-sm text-muted">{category.description}</p>}
      </header>
      <ProductListingPage
        basePath={`/category/${category.slug}`}
        searchParams={sp}
        filters={parseFilters(sp, { category: category.slug })}
        categories={categories}
        showCategoryFilter={false}
      />
    </div>
  );
}
