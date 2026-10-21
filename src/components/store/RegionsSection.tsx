import Link from "next/link";
import { SectionHeading } from "@/components/ui/Ornament";
import type { Category } from "@/lib/types";

/** Native-script names shown as decoration; regions without one just show the English name. */
const NATIVE: Record<string, string> = {
  kashmir: "कश्मीर",
  punjab: "ਪੰਜਾਬ",
  himachal: "हिमाचल",
  uttarakhand: "उत्तराखंड",
  rajasthan: "राजस्थान",
  "uttar-pradesh": "उत्तर प्रदेश",
};

export function RegionsSection({ title, regions, limit }: { title: string; regions: Category[]; limit: number }) {
  if (!regions.length) return null;
  return (
    <section aria-labelledby="regions-title" className="bg-royal py-16 text-ivory sm:py-24">
      <div className="container-page">
        <SectionHeading
          id="regions-title"
          tone="light"
          eyebrow="A journey across Bharat"
          title={title}
          subtitle="Every region keeps its own secrets — walnuts and saffron from the valley, achaar from Punjab, honey from the hills."
        />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {regions.slice(0, limit).map((r) => (
            <li key={r.id}>
              <Link
                href={`/category/${r.slug}`}
                className="arch group relative flex aspect-[3/4] flex-col items-center justify-end overflow-hidden border border-gold-light/40 px-3 pb-6 text-center transition-colors hover:border-gold-light hover:bg-white/5"
              >
                <span className="pointer-events-none absolute inset-2 arch border border-gold-light/15" />
                <span className="font-display text-3xl leading-none text-gold-light/90 transition-transform duration-500 group-hover:-translate-y-1 sm:text-4xl">
                  {NATIVE[r.slug] ?? "✦"}
                </span>
                <span className="mt-4 font-display text-xl font-semibold">{r.name}</span>
                {r.description && <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ivory/60">{r.description}</span>}
                <span className="mt-3 text-[10px] font-semibold tracking-[0.24em] text-gold-light uppercase">Explore →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
