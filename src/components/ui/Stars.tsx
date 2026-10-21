import { Star } from "lucide-react";

export function Stars({ rating, count, size = 14 }: { rating: number | null; count?: number; size?: number }) {
  if (rating === null || rating === undefined) return null;
  const r = Number(rating);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={i <= Math.round(r) ? "fill-saffron text-saffron" : "text-line"}
          />
        ))}
      </span>
      <span className="sr-only">Rated {r.toFixed(1)} out of 5</span>
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}
