import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/Ornament";
import type { Banner } from "@/lib/types";

export function CategoryTiles({ tiles, title }: { tiles: Banner[]; title: string }) {
  if (!tiles.length) return null;
  return (
    <section aria-labelledby="tiles-title" className="bg-ivory-pattern py-16 sm:py-20">
      <div className="container-page">
        <SectionHeading id="tiles-title" eyebrow="Treasures of Bharat" title={title} />
        <ul className="grid grid-cols-2 gap-5 sm:gap-8 lg:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.id}>
              <Link href={t.link_url} className="group block text-center">
                <span className="arch relative block aspect-[3/4] overflow-hidden border border-saffron/40 bg-almond-100 p-2 transition-shadow duration-500 group-hover:shadow-xl group-hover:shadow-walnut/15">
                  <span className="arch relative block h-full w-full overflow-hidden">
                    <Image
                      src={t.image_url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      unoptimized={t.image_url.endsWith(".svg")}
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </span>
                </span>
                <span className="mt-5 block font-display text-2xl font-semibold text-walnut">{t.title}</span>
                <span className="mt-1 inline-block text-[11px] font-semibold tracking-[0.24em] text-saffron-600 uppercase transition-transform group-hover:translate-x-1">
                  Discover →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
