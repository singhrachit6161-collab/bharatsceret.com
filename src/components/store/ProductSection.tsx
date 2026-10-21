import Link from "next/link";
import type { ProductListing } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { ProductRail, RailItem } from "./ProductRail";

export function ProductSection({
  title,
  products,
  viewAllHref,
  note,
}: {
  title: string;
  products: ProductListing[];
  viewAllHref?: string;
  note?: string;
}) {
  if (!products.length) return null;
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id} className="container-page py-8 sm:py-10">
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 id={id} className="section-title">
            {title}
          </h2>
          {note && <p className="mt-1 text-xs text-muted">{note}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="shrink-0 text-sm font-semibold text-saffron-600 hover:text-walnut">
            View all →
          </Link>
        )}
      </div>
      <ProductRail label={title}>
        {products.map((p) => (
          <RailItem key={p.id}>
            <ProductCard product={p} />
          </RailItem>
        ))}
      </ProductRail>
    </section>
  );
}

export function ProductGrid({ products }: { products: ProductListing[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
