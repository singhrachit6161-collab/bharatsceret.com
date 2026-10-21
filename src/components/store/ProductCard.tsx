import Link from "next/link";
import { Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/ui/ProductImage";
import { Stars } from "@/components/ui/Stars";
import { discountPercent } from "@/lib/money";
import type { ProductListing } from "@/lib/types";
import { AddToCartButton } from "./AddToCartButton";

export function ProductCard({ product, priority = false }: { product: ProductListing; priority?: boolean }) {
  const price = product.default_price_paise !== null ? Number(product.default_price_paise) : null;
  const compareAt = product.default_compare_at_paise !== null ? Number(product.default_compare_at_paise) : null;
  const available = product.default_available ?? 0;
  const multi = product.variant_count > 1;
  const pct = price !== null ? discountPercent(price, compareAt) : null;

  return (
    <article className="group relative flex h-full flex-col bg-white/60 ring-1 ring-line/80 transition-all duration-500 hover:bg-white hover:shadow-xl hover:shadow-walnut/10 hover:ring-saffron/50">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-almond-100">
        <ProductImage
          src={product.image_url}
          alt={product.image_alt || product.name}
          priority={priority}
          className="transition-transform duration-700 group-hover:scale-105"
        />
        {pct !== null && pct > 0 && (
          <span className="absolute top-3 left-3 z-10 bg-maroon px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-gold-light uppercase">
            Save {pct}%
          </span>
        )}
        {!product.in_stock && (
          <span className="absolute inset-x-0 bottom-0 bg-walnut/90 py-1.5 text-center text-[11px] font-semibold tracking-[0.2em] text-ivory uppercase">
            Sold out
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col items-center gap-1.5 px-4 pt-5 pb-5 text-center">
        <p className="text-[10px] font-semibold tracking-[0.28em] text-saffron-600 uppercase">
          {product.default_variant_label}
          {multi && ` · ${product.variant_count} sizes`}
        </p>
        <h3 className="line-clamp-2 min-h-[3.25rem] font-display text-xl leading-tight font-semibold text-walnut">
          <Link href={`/product/${product.slug}`} className="hover:text-maroon">
            {product.name}
          </Link>
        </h3>
        {product.review_count > 0 && <Stars rating={product.rating_avg} count={product.review_count} />}
        {price !== null && (
          <div className="mt-auto pt-1">
            <Price price={price} compareAt={compareAt} />
          </div>
        )}
        {available > 0 && available <= 5 && <p className="text-[11px] font-medium text-maroon">Only {available} left</p>}
        <div className="mt-2 w-full">
          {multi ? (
            <Link href={`/product/${product.slug}`} className="btn-outline w-full rounded-none border-walnut/25 px-3 py-2.5 text-[11px] tracking-[0.18em] uppercase hover:border-saffron hover:bg-walnut hover:text-gold-light">
              Select size
            </Link>
          ) : (
            <AddToCartButton variantId={product.default_variant_id} disabled={!product.in_stock} compact label={product.in_stock ? "Add to bag" : "Sold out"} />
          )}
        </div>
      </div>
    </article>
  );
}
