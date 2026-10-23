import { discountPercent, formatINR } from "@/lib/money";

export function Price({
  price,
  compareAt,
  size = "md",
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const pct = discountPercent(price, compareAt);
  const main = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={`${main} font-semibold text-walnut`}>{formatINR(price)}</span>
      {pct !== null && compareAt ? (
        <>
          <span className="text-sm text-muted line-through">
            <span className="sr-only">Original price </span>
            {formatINR(compareAt)}
          </span>
          {size === "lg" && <span className="text-sm font-semibold text-olive">{pct}% off</span>}
        </>
      ) : null}
    </span>
  );
}

export function DiscountBadge({ price, compareAt }: { price: number | null; compareAt: number | null }) {
  const pct = price !== null ? discountPercent(price, compareAt) : null;
  if (pct === null || pct < 1) return null;
  return (
    <span className="absolute top-2 left-2 z-10 rounded-sm bg-saffron px-2 py-0.5 text-xs font-bold text-walnut shadow-sm">
      {pct}% OFF
    </span>
  );
}
