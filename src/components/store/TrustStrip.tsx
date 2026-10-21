import { Headset, Package, ShieldCheck, Truck, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { truck: Truck, package: Package, shield: ShieldCheck, headset: Headset };

export function TrustStrip({ items }: { items: { icon: string; title: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Our promise" className="bg-emerald-royal text-ivory">
      <ul className="container-page grid grid-cols-2 gap-8 py-12 lg:grid-cols-4">
        {items.map((it) => {
          const Icon = ICONS[it.icon] ?? Package;
          return (
            <li key={it.title} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-light/50 text-gold-light">
                <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-semibold text-ivory">{it.title}</span>
              <span className="max-w-[16rem] text-xs leading-relaxed text-ivory/65">{it.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
