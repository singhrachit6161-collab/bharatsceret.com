import { BadgeCheck, PackageCheck, RotateCcw, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PincodeChecker } from "@/components/store/PincodeChecker";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductPurchasePanel } from "@/components/store/ProductPurchasePanel";
import { ProductSection } from "@/components/store/ProductSection";
import { ProductViewTracker } from "@/components/store/ProductViewTracker";
import { RecentlyViewed } from "@/components/store/RecentlyViewed";
import { ReviewForm } from "@/components/store/ReviewForm";
import { WishlistButton } from "@/components/store/WishlistButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Stars } from "@/components/ui/Stars";
import { getSessionUser } from "@/lib/auth";
import { ancestorsOf } from "@/lib/category-tree";
import { getApprovedReviews, getCategories, getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { publicEnv } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found" };
  const image = p.og_image_url || p.images[0]?.url;
  return {
    title: p.seo_title || p.name,
    description: p.seo_description || p.short_description || undefined,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description: p.short_description ?? undefined, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  if (product.isHamperBox) redirect("/build-your-hamper");

  const [reviews, related, user, settings, allCategories] = await Promise.all([
    getApprovedReviews(product.id),
    getRelatedProducts(product),
    getSessionUser(),
    getSettings(),
    getCategories(),
  ]);
  let saved = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("wishlist_items").select("product_id").eq("product_id", product.id).maybeSingle();
    saved = Boolean(data);
  }

  const prices = product.variants.map((v) => v.price_paise);
  const anyInStock = product.variants.some((v) => v.available > 0);
  // Breadcrumb through the product-type branch (not Regions), e.g. Shop > Dry Fruits > Walnuts.
  const withChains = product.categories.map((c) => ({ c, chain: ancestorsOf(c.id, allCategories) }));
  const primary = withChains.find((x) => x.chain[0]?.slug !== "regions") ?? withChains[0];
  const regions = withChains.filter((x) => x.chain[0]?.slug === "regions").map((x) => x.c);
  const toAbs = (u: string) => (u.startsWith("http") ? u : `${publicEnv.siteUrl}${u}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: product.brand },
    description: product.short_description ?? undefined,
    image: product.images.map((i) => toAbs(i.url)),
    offers: prices.length
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          lowPrice: (Math.min(...prices) / 100).toFixed(2),
          highPrice: (Math.max(...prices) / 100).toFixed(2),
          offerCount: prices.length,
          availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${publicEnv.siteUrl}/product/${product.slug}`,
        }
      : undefined,
    ...(product.review_count > 0 && product.rating_avg
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(product.rating_avg), reviewCount: product.review_count } }
      : {}),
  };

  const details: [string, string | null][] = [
    ["Ingredients", product.ingredients],
    ["Allergen information", product.allergen_info],
    ["Storage instructions", product.storage_instructions],
    ["Shelf life", product.shelf_life],
    ["Country of origin", product.country_of_origin],
    ["Manufacturer / packer", product.manufacturer_info],
    ["FSSAI licence", product.fssai_license],
  ];

  return (
    <div className="container-page pb-16">
      <ProductViewTracker productId={product.id} slug={product.slug} />
      <Breadcrumbs
        items={[
          { name: "Shop", href: "/shop" },
          ...(primary ? [...primary.chain, primary.c].map((c) => ({ name: c.name, href: `/category/${c.slug}` })) : []),
          { name: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} name={product.name} />

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-saffron-600 uppercase">
              {product.brand}
              {regions.map((r) => (
                <Link key={r.id} href={`/category/${r.slug}`} className="ml-3 rounded-full border border-saffron/50 px-2.5 py-0.5 tracking-[0.18em] hover:bg-almond-100">
                  {r.name}
                </Link>
              ))}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-walnut sm:text-4xl">{product.name}</h1>
            {product.review_count > 0 && (
              <a href="#reviews" className="mt-2 inline-block">
                <Stars rating={product.rating_avg} count={product.review_count} size={16} />
              </a>
            )}
            {product.short_description && <p className="mt-3 text-ink/85">{product.short_description}</p>}
          </div>

          <ProductPurchasePanel variants={product.variants} />
          <WishlistButton productId={product.id} initialSaved={saved} />
          <PincodeChecker />

          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <Truck size={18} className="mt-0.5 text-olive" aria-hidden="true" />
              <span>
                {settings.shipping.free_shipping_threshold_paise !== null
                  ? `Free shipping on orders above ${formatINR(settings.shipping.free_shipping_threshold_paise)}`
                  : `Shipping ${formatINR(settings.shipping.flat_fee_paise)}`}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <PackageCheck size={18} className="mt-0.5 text-olive" aria-hidden="true" />
              <span>Dispatched in sealed packs</span>
            </li>
            {settings.cod.enabled && (
              <li className="flex items-start gap-2">
                <BadgeCheck size={18} className="mt-0.5 text-olive" aria-hidden="true" />
                <span>Cash on delivery available for eligible orders</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <RotateCcw size={18} className="mt-0.5 text-olive" aria-hidden="true" />
              <Link href="/policies/returns-policy" className="underline-offset-2 hover:underline">
                Returns & refund policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        <section aria-labelledby="desc" className="lg:col-span-2">
          <h2 id="desc" className="section-title mb-4">
            Product details
          </h2>
          {product.description && <div className="prose-store whitespace-pre-line text-sm leading-relaxed">{product.description}</div>}
          <dl className="mt-6 divide-y divide-line rounded-lg border border-line bg-white text-sm">
            {details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                  <dt className="font-medium text-walnut">{k}</dt>
                  <dd className="whitespace-pre-line sm:col-span-2">{v}</dd>
                </div>
              ))}
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
              <dt className="font-medium text-walnut">Net weight / pack sizes</dt>
              <dd className="sm:col-span-2">{product.variants.map((v) => v.label).join(", ")}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Manufacturing / packing date and best-before date are printed on each pack.
          </p>
        </section>

        <section id="reviews" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="section-title mb-4">
            Customer reviews
          </h2>
          {reviews.length ? (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Stars rating={r.rating} />
                    <time className="text-xs text-muted" dateTime={r.created_at}>
                      {new Date(r.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </time>
                  </div>
                  {r.title && <p className="mt-2 font-semibold text-ink">{r.title}</p>}
                  <p className="mt-1 text-sm text-ink/85">{r.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    — {r.author_name}
                    {r.is_verified_purchase && <span className="ml-2 font-semibold text-olive">✓ Verified purchase</span>}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No reviews yet.</p>
          )}
          <div className="mt-6">
            {user ? (
              <ReviewForm productId={product.id} defaultName="" />
            ) : (
              <p className="text-sm">
                <Link href={`/login?next=/product/${product.slug}`} className="font-semibold text-walnut underline">
                  Sign in
                </Link>{" "}
                to write a review.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <ProductSection title="You may also like" products={related} />
      </div>
      <RecentlyViewed excludeSlug={product.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
