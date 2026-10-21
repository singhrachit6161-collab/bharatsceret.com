import Link from "next/link";
import { SectionHeading } from "@/components/ui/Ornament";
import type { ProductListing } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { ProductRail, RailItem } from "./ProductRail";

export function ProductSection({
  title,
  eyebrow,
  products,
  viewAllHref,
  note,
  tone = "plain",
}: {
  title: string;
  eyebrow?: string;
  products: ProductListing[];
  viewAllHref?: string;
  note?: string;
  tone?: "plain" | "cream";
}) {
  if (!products.length) return null;
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id} className={`py-16 sm:py-20 ${tone === "cream" ? "bg-almond-100/60" : ""}`}>
      <div className="container-page">
        <SectionHeading id={id} eyebrow={eyebrow} title={title} subtitle={note} />
        <ProductRail label={title}>
          {products.map((p) => (
            <RailItem key={p.id}>
              <ProductCard product={p} />
            </RailItem>
          ))}
        </ProductRail>
        {viewAllHref && (
          <div className="mt-10 text-center">
            <Link href={viewAllHref} className="inline-block border-b border-saffron pb-1 text-[11px] font-semibold tracking-[0.28em] text-walnut uppercase hover:text-saffron-600">
              View the full collection
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductGrid({ products }: { products: ProductListing[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
