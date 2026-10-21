import Image from "next/image";
import Link from "next/link";
import type { Banner } from "@/lib/types";

const BG: Record<Banner["theme"], string> = {
  walnut: "bg-walnut",
  saffron: "bg-[#e08a2c]",
  olive: "bg-olive",
  cream: "bg-almond",
};

export function PromoBanners({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;
  return (
    <section aria-label="Promotions" className="container-page py-6">
      <ul className={`grid gap-4 ${banners.length > 1 ? "md:grid-cols-2" : ""}`}>
        {banners.map((b) => (
          <li key={b.id}>
            <Link href={b.link_url} className={`group relative flex aspect-[2/1] overflow-hidden rounded-lg sm:aspect-[5/2] ${BG[b.theme] ?? BG.walnut}`}>
              <div className="absolute inset-y-0 right-0 w-1/2">
                <Image
                  src={b.image_url}
                  alt={b.alt}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  unoptimized={b.image_url.endsWith(".svg")}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="relative flex max-w-[50%] flex-col justify-center gap-2 p-5 text-ivory sm:p-8">
                <h3 className="text-xl leading-tight font-semibold sm:text-3xl">{b.title}</h3>
                {b.subtitle && <p className="text-sm opacity-90">{b.subtitle}</p>}
                {b.cta_label && <span className="mt-1 text-sm font-semibold underline underline-offset-4">{b.cta_label} →</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
