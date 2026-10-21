import Image from "next/image";
import Link from "next/link";
import type { Banner } from "@/lib/types";

const BG: Record<Banner["theme"], string> = {
  walnut: "bg-royal",
  saffron: "bg-emerald-royal",
  olive: "bg-royal",
  cream: "bg-emerald-royal",
};

export function PromoBanners({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;
  return (
    <section aria-label="Promotions" className="container-page py-16">
      <ul className={`grid gap-6 ${banners.length > 1 ? "md:grid-cols-2" : ""}`}>
        {banners.map((b) => (
          <li key={b.id}>
            <Link href={b.link_url} className={`gold-frame group relative flex min-h-[260px] overflow-hidden ${BG[b.theme] ?? BG.walnut}`}>
              <div className="absolute inset-y-0 right-0 w-[48%] overflow-hidden">
                <Image
                  src={b.image_url}
                  alt={b.alt}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  unoptimized={b.image_url.endsWith(".svg")}
                  className="object-cover transition-transform duration-700 group-hover:scale-110 [mask-image:linear-gradient(to_right,transparent,black_35%)]"
                />
              </div>
              <div className="relative z-10 flex max-w-[58%] flex-col justify-center gap-3 p-8 text-ivory sm:p-10">
                <p className="eyebrow text-gold-light">Limited edition</p>
                <h3 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{b.title}</h3>
                {b.subtitle && <p className="text-sm text-ivory/75">{b.subtitle}</p>}
                {b.cta_label && <span className="mt-2 text-[11px] font-semibold tracking-[0.24em] text-gold-light uppercase">{b.cta_label} →</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
