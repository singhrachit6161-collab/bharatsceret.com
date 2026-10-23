import type { Metadata } from "next";
import Image from "next/image";
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
  openGraph: { images: [{ url: "/brand/hamper/hero.webp", width: 2000, height: 1250, alt: "Bharat Secrets keepsake hamper boxes" }] },
};

export default async function BuildYourHamperPage() {
  const settings = await getSettings();
  const [boxes, items] = settings.hamper.enabled ? await Promise.all([getHamperBoxes(), getHamperItems()]) : [[], []];
  const ready = settings.hamper.enabled && boxes.length > 0 && items.length > 0;

  return (
    <div className="pb-20">
      <header className="bg-royal relative overflow-hidden text-ivory">
        <div className="container-page grid items-center gap-10 gap-y-4 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-y-10 lg:py-16">
          <div className="text-center lg:text-left">
            <Breadcrumbs tone="light" items={[{ name: "Gifting", href: "/category/gifting" }, { name: "Build your own hamper" }]} />
            <p className="eyebrow mt-6 text-gold-light">The gifting atelier</p>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] font-semibold sm:text-6xl">
              Build Your Own <span className="text-gold-gradient italic">Hamper</span>
            </h1>
            <Ornament className="mt-5 lg:justify-start" tone="light" />
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-ivory/75 lg:mx-0">
              Choose a keepsake box, fill it with your favourite treasures from across Bharat, and add a message from the heart.
            </p>
            <ol className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3 lg:mx-0">
              {["Choose a box", "Fill it", "Add your note"].map((label, i) => (
                <li key={label} className="flex flex-col items-center gap-2 text-center">
                  <Image src={`/brand/hamper/step-${i + 1}.webp`} alt="" width={84} height={84} className="h-16 w-16 drop-shadow-xl sm:h-[84px] sm:w-[84px]" />
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-gold-light uppercase">{label}</span>
                </li>
              ))}
            </ol>
            {ready && (
              <a href="#builder" className="btn-accent mt-8 inline-flex px-8 py-3.5 text-xs uppercase">
                Begin your hamper
              </a>
            )}
          </div>
          <div className="relative order-first lg:order-none">
            <div className="absolute -inset-6 rounded-full bg-gold-light/10 blur-3xl" aria-hidden="true" />
            <Image
              src="/brand/hamper/hero.webp"
              alt="Three Bharat Secrets keepsake boxes presented in gilded palace arches"
              width={2000}
              height={1250}
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="relative h-auto w-full [mask-image:radial-gradient(ellipse_72%_68%_at_50%_50%,black_62%,transparent_100%)]"
            />
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-transparent via-saffron to-transparent" aria-hidden="true" />
      </header>
      <section className="border-b border-saffron/20 bg-ivory-pattern" aria-label="How your hamper is prepared">
        <ul className="container-page grid gap-6 py-6 text-center sm:grid-cols-3">
          {[
            ["Packed to order", "Every hamper is assembled for you once your order is placed."],
            ["Your words, on a card", "Your message goes inside on a keepsake card. Prices are never shown."],
            ["Fresh stock, fair price", "Availability and prices are re-checked at checkout."],
          ].map(([title, text]) => (
            <li key={title}>
              <p className="font-display text-xl font-semibold text-walnut">{title}</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <div id="builder" className="container-page scroll-mt-40 pt-12">
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
