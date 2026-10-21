import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CartLineControls } from "@/components/store/CartLineControls";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/ui/ProductImage";
import { getCartView, toPricedLines } from "@/lib/data/cart";
import { codRules, getSettings, shippingRules } from "@/lib/data/settings";
import { formatINR } from "@/lib/money";
import { computeTotals } from "@/lib/pricing";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

const ISSUE_TEXT = {
  unavailable: "No longer available — please remove it.",
  insufficient_stock: "Not enough stock for this quantity.",
  over_limit: "Quantity exceeds the per-order limit.",
} as const;

export default async function CartPage() {
  const [lines, settings] = await Promise.all([getCartView(), getSettings()]);
  if (!lines.length) {
    return (
      <div className="container-page py-10">
        <h1 className="section-title mb-6">Your cart</h1>
        <EmptyState icon={<ShoppingBag size={40} />} title="Your cart is empty" description="Explore our dry fruits, nuts and gift hampers." actionHref="/shop" actionLabel="Start shopping" />
      </div>
    );
  }
  const totals = computeTotals({
    lines: toPricedLines(lines.filter((l) => !l.issue)),
    discountPaise: 0,
    shipping: shippingRules(settings),
    cod: codRules(settings),
    paymentMethod: "razorpay",
  });
  const hasIssues = lines.some((l) => l.issue);
  const threshold = settings.shipping.free_shipping_threshold_paise;
  const remaining = threshold !== null ? threshold - totals.subtotalPaise : null;

  return (
    <div className="container-page pb-16">
      <Breadcrumbs items={[{ name: "Cart" }]} />
      <h1 className="section-title mb-6">Your cart</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="card divide-y divide-line">
          {lines.map((l) => (
            <li key={l.variantId} className="flex gap-4 p-4">
              <Link href={`/product/${l.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-almond-100">
                <ProductImage src={l.imageUrl} alt={l.name} sizes="96px" />
              </Link>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <Link href={`/product/${l.slug}`} className="font-medium text-ink hover:underline">
                    {l.name}
                  </Link>
                  <p className="text-xs text-muted">{l.label}</p>
                  <div className="mt-1">
                    <Price price={l.unitPricePaise} compareAt={l.compareAtPaise} size="sm" />
                  </div>
                  {l.issue && <p className="mt-1 text-xs font-medium text-danger">{ISSUE_TEXT[l.issue]}</p>}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <CartLineControls variantId={l.variantId} quantity={l.quantity} max={Math.min(l.maxPerOrder, Math.max(l.available, l.quantity))} />
                  <p className="text-sm font-semibold text-walnut">{formatINR(l.unitPricePaise * l.quantity)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-3 p-5" aria-labelledby="summary">
          <h2 id="summary" className="text-lg font-semibold text-walnut">
            Order summary
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatINR(totals.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{totals.shippingPaise === 0 ? "Free" : formatINR(totals.shippingPaise)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-walnut">
              <dt>Estimated total</dt>
              <dd>{formatINR(totals.totalPaise)}</dd>
            </div>
          </dl>
          {remaining !== null && remaining > 0 && (
            <p className="rounded-md bg-almond-100 p-3 text-xs text-walnut">Add {formatINR(remaining)} more for free shipping.</p>
          )}
          <p className="text-xs text-muted">Coupons, cash-on-delivery fees and final totals are calculated at checkout.</p>
          {hasIssues ? (
            <p className="text-sm font-medium text-danger" role="alert">Please fix the highlighted items to continue.</p>
          ) : (
            <Link href="/checkout" className="btn-primary w-full">
              Proceed to checkout
            </Link>
          )}
          <Link href="/shop" className="btn-ghost w-full">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
