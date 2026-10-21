import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getPackSizes, listProducts, SORT_OPTIONS, type ProductFilters, type SortKey } from "@/lib/data/catalog";
import { rupeesToPaise } from "@/lib/money";
import { buildTree, flattenTree } from "@/lib/category-tree";
import type { Category } from "@/lib/types";
import { ProductGrid } from "./ProductSection";

type SearchParams = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 24;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseFilters(sp: SearchParams, base: Partial<ProductFilters> = {}): ProductFilters {
  const sort = first(sp.sort);
  const min = first(sp.min);
  const max = first(sp.max);
  const page = Number(first(sp.page) ?? "1");
  return {
    ...base,
    q: base.q ?? first(sp.q)?.slice(0, 80),
    category: base.category ?? first(sp.category),
    sort: sort && sort in SORT_OPTIONS ? (sort as SortKey) : base.sort,
    minPrice: min ? (rupeesToPaise(min) ?? undefined) : undefined,
    maxPrice: max ? (rupeesToPaise(max) ?? undefined) : undefined,
    inStock: first(sp.stock) === "1",
    pack: first(sp.pack)?.slice(0, 40),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZE,
  };
}

export async function ProductListingPage({
  basePath,
  searchParams,
  filters,
  categories,
  showCategoryFilter = true,
}: {
  basePath: string;
  searchParams: SearchParams;
  filters: ProductFilters;
  categories: Category[];
  showCategoryFilter?: boolean;
}) {
  const [{ items, total }, packs] = await Promise.all([listProducts(filters), getPackSizes(filters.category)]);

  const keep = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      const val = first(v);
      if (val && k !== "page") p.set(k, val);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const hasFilters = ["min", "max", "stock", "pack", "category"].some((k) => first(searchParams[k]));

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside aria-label="Filters">
        <details className="card group p-4 lg:open:block" open>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-walnut lg:cursor-default">
            <SlidersHorizontal size={18} aria-hidden="true" /> Filters
          </summary>
          <form method="get" action={basePath} className="mt-4 space-y-5 text-sm">
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {first(searchParams.sort) && <input type="hidden" name="sort" value={first(searchParams.sort)} />}
            {showCategoryFilter && categories.length > 0 && (
              <div>
                <label htmlFor="f-category" className="label">
                  Category
                </label>
                <select id="f-category" name="category" defaultValue={first(searchParams.category) ?? ""} className="input">
                  <option value="">All categories</option>
                  {flattenTree(buildTree(categories)).map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {"\u00a0\u00a0".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <fieldset>
              <legend className="label">Price (₹)</legend>
              <div className="flex items-center gap-2">
                <label htmlFor="f-min" className="sr-only">Minimum price</label>
                <input id="f-min" name="min" inputMode="decimal" placeholder="Min" defaultValue={first(searchParams.min)} className="input" />
                <span aria-hidden="true">–</span>
                <label htmlFor="f-max" className="sr-only">Maximum price</label>
                <input id="f-max" name="max" inputMode="decimal" placeholder="Max" defaultValue={first(searchParams.max)} className="input" />
              </div>
            </fieldset>
            {packs.length > 0 && (
              <div>
                <label htmlFor="f-pack" className="label">
                  Pack size
                </label>
                <select id="f-pack" name="pack" defaultValue={first(searchParams.pack) ?? ""} className="input">
                  <option value="">Any size</option>
                  {packs.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" name="stock" value="1" defaultChecked={first(searchParams.stock) === "1"} className="h-4 w-4 accent-walnut" />
              In stock only
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 py-2">
                Apply
              </button>
              {hasFilters && (
                <Link href={keep({ min: undefined, max: undefined, stock: undefined, pack: undefined, category: undefined })} className="btn-outline py-2">
                  Clear
                </Link>
              )}
            </div>
          </form>
        </details>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {total} {total === 1 ? "product" : "products"}
          </p>
          <nav aria-label="Sort products" className="flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-muted">Sort:</span>
            {(Object.entries(SORT_OPTIONS) as [SortKey, string][]).map(([key, label]) => {
              const current = (first(searchParams.sort) ?? "featured") === key;
              return (
                <Link
                  key={key}
                  href={keep({ sort: key === "featured" ? undefined : key })}
                  aria-current={current ? "true" : undefined}
                  className={`rounded-full px-3 py-1 ${current ? "bg-walnut text-ivory" : "text-walnut hover:bg-almond-100"}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        {items.length ? (
          <ProductGrid products={items} />
        ) : (
          <EmptyState
            title="No products found"
            description="Try removing some filters or searching for something else."
            actionHref={basePath}
            actionLabel="Clear filters"
          />
        )}
        <Pagination page={filters.page ?? 1} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => keep({ page: p > 1 ? String(p) : undefined })} />
      </div>
    </div>
  );
}
