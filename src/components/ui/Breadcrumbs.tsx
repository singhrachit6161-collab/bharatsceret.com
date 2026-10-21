import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { publicEnv } from "@/lib/env";

export interface Crumb {
  name: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ name: "Home", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.href ? { item: `${publicEnv.siteUrl}${c.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Breadcrumb" className="py-3 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((c, i) => (
          <li key={i} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className="hover:text-walnut hover:underline">
                {c.name}
              </Link>
            ) : (
              <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-ink">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </nav>
  );
}
