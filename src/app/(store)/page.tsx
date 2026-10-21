import { CategoryTiles } from "@/components/store/CategoryTiles";
import { HeroCarousel } from "@/components/store/HeroCarousel";
import { PromoBanners } from "@/components/store/PromoBanners";
import { ProductSection } from "@/components/store/ProductSection";
import { TrustStrip } from "@/components/store/TrustStrip";
import { getHomepageData } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { publicEnv } from "@/lib/env";
import type { HomepageSection } from "@/lib/types";

export default async function HomePage() {
  const [data, settings] = await Promise.all([getHomepageData(), getSettings()]);
  const visible = (key: HomepageSection["key"]) => data.sections.find((s) => s.key === key)?.is_visible ?? true;
  const title = (key: HomepageSection["key"], fallback: string) => data.sections.find((s) => s.key === key)?.title ?? fallback;

  const blocks: Record<HomepageSection["key"], React.ReactNode> = {
    category_tiles: <CategoryTiles key="tiles" tiles={data.tiles} />,
    bestsellers: <ProductSection key="best" title={title("bestsellers", "Bestsellers")} products={data.bestsellers} viewAllHref="/shop?sort=popular" />,
    most_viewed: <ProductSection key="viewed" title={title("most_viewed", "Most viewed")} products={data.mostViewed} note="Based on product page visits in the last 30 days" />,
    latest: <ProductSection key="latest" title={title("latest", "Latest arrivals")} products={data.latest} viewAllHref="/shop?sort=newest" />,
    promo_banners: <PromoBanners key="promos" banners={data.promos} />,
    featured: <ProductSection key="featured" title={title("featured", "Featured")} products={data.featured} viewAllHref="/shop" />,
  };
  const order: HomepageSection["key"][] = data.sections.length
    ? data.sections.map((s) => s.key)
    : ["category_tiles", "bestsellers", "most_viewed", "latest", "promo_banners", "featured"];

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.store_contact.brand_name || "SwaadVana",
    url: publicEnv.siteUrl,
    ...(settings.store_contact.email ? { email: settings.store_contact.email } : {}),
  };

  return (
    <>
      <h1 className="sr-only">SwaadVana — premium dry fruits, nuts and gift hampers</h1>
      <div className="container-page pt-4">
        <HeroCarousel slides={data.hero} />
      </div>
      {order.filter(visible).map((key) => blocks[key])}
      <div className="mt-6">
        <TrustStrip items={settings.trust_strip} />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
