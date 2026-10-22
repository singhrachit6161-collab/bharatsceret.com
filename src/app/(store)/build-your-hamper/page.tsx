import type { Metadata } from "next";
import { HamperBuilder } from "@/components/store/HamperBuilder";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ornament } from "@/components/ui/Ornament";
import { MAX_MESSAGE, MAX_RECIPIENT } from "@/lib/cart";
import { getHamperBoxes, getHamperItems } from "@/lib/data/hamper";
import { getSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Build your own hamper",
  description: "Choose a keepsake box, fill it with dry fruits, spices, teas and pantry treasures, and add a personal message.",
  alternates: { canonical: "/build-your-hamper" },
};

export default async function BuildYourHamperPage() {
  const settings = await getSettings();
  const [boxes, items] = settings.hamper.enabled ? await Promise.all([getHamperBoxes(), getHamperItems()]) : [[], []];
  const ready = settings.hamper.enabled && boxes.length > 0 && items.length > 0;

  return (
    <div className="pb-20">
      <header className="bg-royal py-14 text-center text-ivory sm:py-20">
        <div className="container-page">
          <Breadcrumbs tone="light" items={[{ name: "Gifting", href: "/category/gifting" }, { name: "Build your own hamper" }]} />
          <p className="eyebrow mt-4 text-gold-light">The gifting atelier</p>
          <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">Build Your Own Hamper</h1>
          <Ornament className="mt-5" tone="light" />
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ivory/75">
            Choose a keepsake box, fill it with your favourite treasures from across Bharat, and add a message from the heart.
          </p>
        </div>
      </header>
      <div className="container-page pt-12">
        {ready ? (
          <HamperBuilder
            boxes={boxes.map((b) => ({ variantId: b.variantId, name: b.name, description: b.description, capacity: b.capacity, pricePaise: b.pricePaise, available: b.available, imageUrl: b.imageUrl }))}
            items={items.map((i) => ({ variantId: i.variantId, name: i.name, label: i.label, pricePaise: i.pricePaise, available: i.available, maxPerOrder: i.maxPerOrder, imageUrl: i.imageUrl, collection: i.collection }))}
            minItems={settings.hamper.min_items}
            messageMax={Math.min(MAX_MESSAGE, settings.hamper.message_max || MAX_MESSAGE)}
            recipientMax={MAX_RECIPIENT}
          />
        ) : (
          <EmptyState title="Our hamper atelier opens soon" description="Meanwhile, explore our ready-made gift collections." actionHref="/category/gifting" actionLabel="Shop gifting" />
        )}
      </div>
    </div>
  );
}
