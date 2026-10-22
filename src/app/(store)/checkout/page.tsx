import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/store/CheckoutForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { requireUser } from "@/lib/auth";
import { quoteCheckout } from "@/lib/checkout";
import { getCartView } from "@/lib/data/cart";
import { formatINR } from "@/lib/money";
import { isRazorpayConfigured, isRazorpayLiveMode } from "@/lib/server-env";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const view = await getCartView();
  if (view.isEmpty || view.hasIssues) redirect("/cart");
  const lines = view.lines;
  const count = lines.length + view.bundles.length;

  const supabase = await createClient();
  const { data: addresses } = await supabase
    .from("addresses")
    .select("id, full_name, phone, line1, line2, landmark, city, state, pincode, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  const quote = await quoteCheckout({ userId: user.id, priced: view.priced, couponCode: null, paymentMethod: "razorpay" });

  return (
    <div className="container-page pb-16">
      <Breadcrumbs items={[{ name: "Cart", href: "/cart" }, { name: "Checkout" }]} />
      <h1 className="section-title mb-6">Checkout</h1>
      <details className="card mb-6 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-walnut">
          {count} {count === 1 ? "item" : "items"} in your order ·{" "}
          <Link href="/cart" className="font-normal underline">Edit cart</Link>
        </summary>
        <ul className="mt-3 divide-y divide-line">
          {view.bundles.map((b) => (
            <li key={b.id} className="flex justify-between gap-3 py-2">
              <span>
                <strong>Custom hamper</strong> · {b.box.name} ({b.units} items)
                {b.recipient && <span className="text-muted"> · for {b.recipient}</span>}
                <span className="block text-xs text-muted">{b.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</span>
              </span>
              <span className="shrink-0">{formatINR(b.subtotalPaise)}</span>
            </li>
          ))}
          {lines.map((l) => (
            <li key={l.variantId} className="flex justify-between py-2">
              <span>{l.name} · {l.label} × {l.quantity}</span>
              <span>{formatINR(l.unitPricePaise * l.quantity)}</span>
            </li>
          ))}
        </ul>
      </details>
      <CheckoutForm
        addresses={(addresses ?? []) as Address[]}
        initialQuote={quote}
        idempotencyKey={randomUUID()}
        razorpayEnabled={isRazorpayConfigured()}
        testMode={!isRazorpayLiveMode()}
      />
    </div>
  );
}
