import Link from "next/link";

export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="btn-ghost px-3" rel="prev">
          Previous
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="inline-flex items-center">
          {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm ${
              n === page ? "bg-walnut text-ivory" : "text-walnut hover:bg-almond-100"
            }`}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={hrefFor(page + 1)} className="btn-ghost px-3" rel="next">
          Next
        </Link>
      )}
    </nav>
  );
}
