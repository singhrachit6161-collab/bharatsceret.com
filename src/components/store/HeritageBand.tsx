import Image from "next/image";
import Link from "next/link";
import { Ornament } from "@/components/ui/Ornament";
import type { StoreSettings } from "@/lib/data/settings";

export function HeritageBand({ heritage }: { heritage: StoreSettings["heritage"] }) {
  if (!heritage.enabled || !heritage.title) return null;
  return (
    <section aria-labelledby="heritage-title" className="bg-royal relative overflow-hidden py-20 text-ivory sm:py-28">
      <div className="container-page grid items-center gap-14 lg:grid-cols-2">
        <div className="relative mx-auto w-full max-w-md">
          <div className="arch relative aspect-[4/5] overflow-hidden border border-gold-light/40 p-3">
            <div className="arch relative h-full overflow-hidden">
              <Image src={heritage.image_url || "/brand/heritage-peacock-box.webp"} alt="Bharat Secrets gift boxes" fill sizes="448px" unoptimized={(heritage.image_url ?? "").endsWith(".svg")} className="object-cover" />
            </div>
          </div>
          <div className="absolute -right-4 -bottom-6 hidden border border-gold-light/40 bg-emerald px-6 py-5 text-center shadow-2xl sm:block">
            <p className="font-display text-3xl font-semibold text-gold-light">भारत</p>
            <p className="mt-1 text-[10px] tracking-[0.3em] text-ivory/70 uppercase">Rooted in India</p>
          </div>
        </div>
        <div className="text-center lg:text-left">
          {heritage.eyebrow && <p className="eyebrow text-gold-light">{heritage.eyebrow}</p>}
          <h2 id="heritage-title" className="mt-4 font-display text-4xl leading-tight font-semibold sm:text-5xl">
            {heritage.title}
          </h2>
          <Ornament className="mt-6 lg:justify-start" tone="light" />
          {heritage.body && <p className="mt-6 leading-relaxed text-ivory/75">{heritage.body}</p>}
          {heritage.pillars.length > 0 && (
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              {heritage.pillars.map((p, i) => (
                <li key={p.title} className="border-t border-gold-light/30 pt-4">
                  <span className="font-display text-2xl text-gold-light">0{i + 1}</span>
                  <p className="mt-1 font-display text-lg font-semibold">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ivory/65">{p.text}</p>
                </li>
              ))}
            </ul>
          )}
          {heritage.cta_label && heritage.cta_url && (
            <Link href={heritage.cta_url} className="btn mt-10 border border-gold-light/60 px-8 py-3.5 text-xs tracking-[0.2em] text-gold-light uppercase hover:bg-gold-light/10">
              {heritage.cta_label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
