import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseFilters, ProductListingPage } from "@/components/store/ProductListingPage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Ornament } from "@/components/ui/Ornament";
import { ancestorsOf, childrenOf } from "@/lib/category-tree";
import { getCategories, getCategoryBySlug } from "@/lib/data/catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Collection not found" };
  return {
    title: category.seo_title || category.name,
    description: category.seo_description || category.description || `Shop ${category.name} at Bharat Secrets.`,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: { title: category.name, images: category.image_url ? [category.image_url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, categories] = await Promise.all([getCategoryBySlug(slug), getCategories()]);
  if (!category) notFound();
  const ancestors = ancestorsOf(category.id, categories);
  const children = childrenOf(category.id, categories);
  const siblings = category.parent_id ? childrenOf(category.parent_id, categories) : [];

  return (
    <div className="pb-16">
      <header className="bg-royal relative overflow-hidden py-14 text-center text-ivory sm:py-20">
        <div className="container-page">
          <Breadcrumbs
            tone="light"
            items={[
              { name: "Shop", href: "/shop" },
              ...ancestors.map((a) => ({ name: a.name, href: `/category/${a.slug}` })),
              { name: category.name },
            ]}
          />
          <p className="eyebrow mt-4 text-gold-light">{ancestors.at(-1)?.name ?? "The collection"}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">{category.name}</h1>
          <Ornament className="mt-5" tone="light" />
          {category.description && <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ivory/75">{category.description}</p>}
        </div>
      </header>

      {children.length > 0 && (
        <nav aria-label={`${category.name} collections`} className="no-scrollbar overflow-x-auto border-b border-line bg-ivory-pattern">
          {/* w-max + mx-auto centres short lists while long ones scroll from the first item. */}
          <ul className="mx-auto flex w-max gap-5 px-4 py-8 sm:px-6">
            {children.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link href={`/category/${c.slug}`} className="group flex w-28 flex-col items-center text-center sm:w-32">
                  <span className="arch relative block h-32 w-24 overflow-hidden border border-saffron/50 bg-almond-100 p-1 transition-shadow group-hover:shadow-lg sm:h-36 sm:w-28">
                    <span className="arch relative block h-full w-full overflow-hidden">
                      {c.image_url && (
                        <Image src={c.image_url} alt="" fill sizes="112px" unoptimized={c.image_url.endsWith(".svg")} className="object-cover transition-transform duration-500 group-hover:scale-110" />
                      )}
                    </span>
                  </span>
                  <span className="mt-3 font-display text-lg leading-tight font-semibold text-walnut group-hover:text-saffron-600">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {siblings.length > 1 && (
        <nav aria-label="Related collections" className="no-scrollbar overflow-x-auto border-b border-line">
          <ul className="mx-auto flex w-max gap-2 px-4 py-4 sm:px-6">
            {siblings.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`/category/${c.slug}`}
                  aria-current={c.id === category.id ? "page" : undefined}
                  className={`block rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.12em] uppercase ${
                    c.id === category.id ? "border-walnut bg-walnut text-gold-light" : "border-saffron/40 text-walnut hover:border-saffron"
                  }`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="container-page pt-10">
        <ProductListingPage
          basePath={`/category/${category.slug}`}
          searchParams={sp}
          filters={parseFilters(sp, { category: category.slug })}
          categories={categories}
          showCategoryFilter={false}
        />
      </div>
    </div>
  );
}
