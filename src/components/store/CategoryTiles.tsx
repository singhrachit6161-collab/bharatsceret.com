import Image from "next/image";
import Link from "next/link";
import type { Banner } from "@/lib/types";

const TILE_BG: Record<Banner["theme"], string> = {
  walnut: "bg-[#6b4226]",
  saffron: "bg-[#c4741f]",
  olive: "bg-[#7a1f2b]",
  cream: "bg-[#3d3470]",
};

export function CategoryTiles({ tiles }: { tiles: Banner[] }) {
  if (!tiles.length) return null;
  return (
    <section aria-label="Featured categories" className="container-page pt-6">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.id}>
            <Link
              href={t.link_url}
              className={`group relative block aspect-[4/3] overflow-hidden rounded-lg ${TILE_BG[t.theme] ?? TILE_BG.walnut}`}
            >
              <Image
                src={t.image_url}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                unoptimized={t.image_url.endsWith(".svg")}
                className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pt-3 pb-8 text-center">
                <span className="font-display text-lg font-semibold tracking-wide text-ivory uppercase sm:text-xl">
                  {t.title}
                </span>
              </span>
              {t.subtitle && <span className="sr-only">{t.subtitle}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
