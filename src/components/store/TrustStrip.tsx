import { Headset, Package, ShieldCheck, Truck, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { truck: Truck, package: Package, shield: ShieldCheck, headset: Headset };

export function TrustStrip({ items }: { items: { icon: string; title: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Why shop with us" className="border-y border-line bg-white">
      <ul className="container-page grid grid-cols-2 gap-6 py-6 lg:grid-cols-4">
        {items.map((it) => {
          const Icon = ICONS[it.icon] ?? Package;
          return (
            <li key={it.title} className="flex items-start gap-3">
              <span className="rounded-full bg-almond-100 p-2.5 text-walnut">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-walnut">{it.title}</span>
                <span className="block text-xs text-muted">{it.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
