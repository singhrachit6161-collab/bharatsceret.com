import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/Ornament";

/** Brand portfolio artwork: the collections infographic beside the campaign poster. */
export function BrandShowcase({ title }: { title: string }) {
  return (
    <section aria-labelledby="showcase-title" className="bg-ivory-pattern py-16 sm:py-24">
      <div className="container-page">
        <SectionHeading
          id="showcase-title"
          eyebrow="Explore the authentic essence of Bharat"
          title={title}
          subtitle="Heritage spice tins, artisanal jars, embroidered pouches and curated gift collections — presented the royal way."
        />
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <figure className="border border-saffron/50 bg-white p-2 shadow-xl shadow-walnut/10">
            <div className="relative aspect-[1264/843] overflow-hidden">
              <Image
                src="/brand/artisanal-portfolio.webp"
                alt="The Bharat Secrets artisanal portfolio: heritage spice tins, artisanal elixirs and jars, gifting pouches and sachets, and curated gift collections"
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="object-cover"
              />
            </div>
          </figure>
          <figure className="border border-saffron/50 bg-white p-2 shadow-xl shadow-walnut/10">
            <div className="relative aspect-[896/1195] overflow-hidden">
              <Image
                src="/brand/poster.webp"
                alt="Bharat Secrets — Discover India's handcrafted wonders. Artisanal luxury, curated for you."
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
          </figure>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/category/gifting" className="btn-primary rounded-none px-8 py-3.5 text-xs tracking-[0.2em] uppercase">
            Curated gift collections
          </Link>
          <Link href="/shop" className="btn-outline rounded-none border-saffron/60 px-8 py-3.5 text-xs tracking-[0.2em] uppercase">
            Shop all
          </Link>
        </div>
      </div>
    </section>
  );
}
