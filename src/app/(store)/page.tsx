import { BrandShowcase } from "@/components/store/BrandShowcase";
import { CategoryTiles } from "@/components/store/CategoryTiles";
import { HeritageBand } from "@/components/store/HeritageBand";
import { HeroCarousel } from "@/components/store/HeroCarousel";
import { PromoBanners } from "@/components/store/PromoBanners";
import { RegionsSection } from "@/components/store/RegionsSection";
import { ProductSection } from "@/components/store/ProductSection";
import { TrustStrip } from "@/components/store/TrustStrip";
import { childrenOf } from "@/lib/category-tree";
import { getCategories, getHomepageData } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { publicEnv } from "@/lib/env";
import type { HomepageSection } from "@/lib/types";

export default async function HomePage() {
  const [data, settings, categories] = await Promise.all([getHomepageData(), getSettings(), getCategories()]);
  const regionsRoot = categories.find((c) => c.slug === "regions" && !c.parent_id);
  const regionList = regionsRoot ? childrenOf(regionsRoot.id, categories) : [];
  const visible = (key: HomepageSection["key"]) => data.sections.find((s) => s.key === key)?.is_visible ?? true;
  const title = (key: HomepageSection["key"], fallback: string) => data.sections.find((s) => s.key === key)?.title ?? fallback;

  const blocks: Record<HomepageSection["key"], React.ReactNode> = {
    category_tiles: <CategoryTiles key="tiles" tiles={data.tiles} title={title("category_tiles", "The Collections")} />,
    bestsellers: (
      <div key="best">
        <ProductSection eyebrow="Most coveted" title={title("bestsellers", "Bestsellers")} products={data.bestsellers} viewAllHref="/shop?sort=popular" />
        <HeritageBand heritage={settings.heritage} />
      </div>
    ),
    most_viewed: <ProductSection key="viewed" eyebrow="Admired this month" title={title("most_viewed", "Most viewed")} products={data.mostViewed} note="Based on product page visits in the last 30 days" tone="cream" />,
    latest: <ProductSection key="latest" eyebrow="Fresh from the harvest" title={title("latest", "New arrivals")} products={data.latest} viewAllHref="/shop?sort=newest" />,
    promo_banners: <PromoBanners key="promos" banners={data.promos} />,
    regions: (
      <RegionsSection
        key="regions"
        title={title("regions", "Explore by region")}
        regions={regionList}
        limit={data.sections.find((x) => x.key === "regions")?.item_limit ?? 12}
      />
    ),
    brand_showcase: <BrandShowcase key="showcase" title={title("brand_showcase", "The Artisanal Portfolio")} />,
    featured: <ProductSection key="featured" eyebrow="The connoisseur’s edit" title={title("featured", "Featured")} products={data.featured} viewAllHref="/shop" tone="cream" />,
  };
  const order: HomepageSection["key"][] = data.sections.length
    ? data.sections.map((s) => s.key)
    : ["category_tiles", "bestsellers", "brand_showcase", "regions", "most_viewed", "latest", "promo_banners", "featured"];

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.store_contact.brand_name || "Bharat Secrets",
    url: publicEnv.siteUrl,
    ...(settings.store_contact.email ? { email: settings.store_contact.email } : {}),
  };

  return (
    <>
      <h1 className="sr-only">Bharat Secrets — royal Indian dry fruits, nuts and luxury gift hampers</h1>
      <HeroCarousel slides={data.hero} />
      {order.filter(visible).map((key) => blocks[key])}
      <TrustStrip items={settings.trust_strip} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
