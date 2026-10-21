import Link from "next/link";
import { DiscountBadge, Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/ui/ProductImage";
import { Stars } from "@/components/ui/Stars";
import type { ProductListing } from "@/lib/types";
import { AddToCartButton } from "./AddToCartButton";

export function ProductCard({ product, priority = false }: { product: ProductListing; priority?: boolean }) {
  const price = product.default_price_paise !== null ? Number(product.default_price_paise) : null;
  const compareAt = product.default_compare_at_paise !== null ? Number(product.default_compare_at_paise) : null;
  const available = product.default_available ?? 0;
  const multi = product.variant_count > 1;

  return (
    <article className="group card relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <DiscountBadge price={price} compareAt={compareAt} />
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-almond-100">
        <ProductImage
          src={product.image_url}
          alt={product.image_alt || product.name}
          priority={priority}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {!product.in_stock && (
          <span className="absolute inset-x-0 bottom-0 bg-walnut/85 py-1 text-center text-xs font-semibold text-ivory">
            Out of stock
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 min-h-10 font-sans text-sm leading-5 font-medium text-ink">
          <Link href={`/product/${product.slug}`} className="hover:text-walnut hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted">
          {product.default_variant_label}
          {multi && ` · ${product.variant_count} sizes`}
        </p>
        {product.review_count > 0 && <Stars rating={product.rating_avg} count={product.review_count} />}
        {price !== null && (
          <div className="mt-auto pt-1">
            <Price price={price} compareAt={compareAt} />
          </div>
        )}
        {available > 0 && available <= 5 && <p className="text-xs font-medium text-danger">Only {available} left</p>}
        <div className="pt-1">
          {multi ? (
            <Link href={`/product/${product.slug}`} className="btn-outline w-full px-3 py-2 text-xs">
              Choose size
            </Link>
          ) : (
            <AddToCartButton variantId={product.default_variant_id} disabled={!product.in_stock} compact />
          )}
        </div>
      </div>
    </article>
  );
}
