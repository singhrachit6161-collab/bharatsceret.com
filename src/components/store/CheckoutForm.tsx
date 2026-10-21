"use client";

import { CreditCard, Plus, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { placeOrder, previewCheckout, type PlaceOrderState } from "@/app/actions/checkout";
import type { Quote } from "@/lib/checkout";
import { formatINR } from "@/lib/money";
import type { Address } from "@/lib/types";
import { AddressForm } from "./AddressForm";

export function CheckoutForm({
  addresses,
  initialQuote,
  idempotencyKey,
  razorpayEnabled,
  testMode,
}: {
  addresses: Address[];
  initialQuote: Quote;
  idempotencyKey: string;
  razorpayEnabled: boolean;
  testMode: boolean;
}) {
  const router = useRouter();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? "");
  const [adding, setAdding] = useState(addresses.length === 0);
  const [method, setMethod] = useState<"razorpay" | "cod">(razorpayEnabled ? "razorpay" : "cod");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [quote, setQuote] = useState(initialQuote);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [state, action, submitting] = useActionState<PlaceOrderState, FormData>(placeOrder, null);

  const refresh = useCallback(
    (coupon: string | null, m: "razorpay" | "cod") =>
      startQuote(async () => {
        const r = await previewCheckout({ couponCode: coupon, paymentMethod: m });
        if (!r.ok) {
          setCouponMsg(r.error);
          return;
        }
        setQuote(r.quote);
        if (coupon) {
          if (r.quote.coupon) {
            setAppliedCoupon(r.quote.coupon.code);
            setCouponMsg(`Coupon ${r.quote.coupon.code} applied.`);
          } else {
            setAppliedCoupon(null);
            setCouponMsg(r.quote.couponError);
          }
        }
      }),
    [],
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(state.next === "pay" ? `/checkout/pay/${state.orderId}` : `/account/orders/${encodeURIComponent(state.orderNumber)}?placed=1`);
    }
  }, [state, router]);

  const t = quote.totals;
  const codBlocked = !t.codAvailable;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="card p-5" aria-labelledby="addr-title">
          <h2 id="addr-title" className="mb-4 flex items-center gap-2 text-lg font-semibold text-walnut">
            <Truck size={20} aria-hidden="true" /> Delivery address
          </h2>
          {addresses.length > 0 && (
            <fieldset>
              <legend className="sr-only">Choose a delivery address</legend>
              <ul className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <label className={`block cursor-pointer rounded-md border p-3 text-sm ${addressId === a.id ? "border-walnut bg-almond-100" : "border-line hover:border-walnut/50"}`}>
                      <input type="radio" name="address_choice" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="sr-only" />
                      <span className="font-semibold">{a.full_name}</span> · {a.phone}
                      <span className="mt-1 block text-muted">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {adding ? (
            <div className="mt-4 rounded-md border border-dashed border-line p-4">
              <AddressForm
                submitLabel="Save and use this address"
                onSaved={(id) => {
                  setAddressId(id);
                  setAdding(false);
                  router.refresh();
                }}
                onCancel={addresses.length ? () => setAdding(false) : undefined}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="btn-ghost mt-3 px-0">
              <Plus size={16} aria-hidden="true" /> Add a new address
            </button>
          )}
        </section>

        <section className="card p-5" aria-labelledby="pay-title">
          <h2 id="pay-title" className="mb-4 flex items-center gap-2 text-lg font-semibold text-walnut">
            <CreditCard size={20} aria-hidden="true" /> Payment method
          </h2>
          <fieldset className="space-y-3">
            <legend className="sr-only">Choose a payment method</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${method === "razorpay" ? "border-walnut bg-almond-100" : "border-line"} ${!razorpayEnabled ? "opacity-50" : ""}`}>
              <input type="radio" name="pm" checked={method === "razorpay"} disabled={!razorpayEnabled} onChange={() => { setMethod("razorpay"); refresh(appliedCoupon, "razorpay"); }} className="mt-1 accent-walnut" />
              <span>
                <span className="block text-sm font-semibold">Pay online — UPI, cards, netbanking, wallets</span>
                <span className="block text-xs text-muted">
                  {razorpayEnabled ? "Secure payment via Razorpay." : "Online payment is not configured yet."}
                  {razorpayEnabled && testMode && <strong className="ml-1 text-danger">TEST MODE — no real money is charged.</strong>}
                </span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${method === "cod" ? "border-walnut bg-almond-100" : "border-line"} ${codBlocked ? "opacity-50" : ""}`}>
              <input type="radio" name="pm" checked={method === "cod"} disabled={codBlocked} onChange={() => { setMethod("cod"); refresh(appliedCoupon, "cod"); }} className="mt-1 accent-walnut" />
              <span>
                <span className="block text-sm font-semibold">Cash on delivery</span>
                <span className="block text-xs text-muted">{codBlocked ? t.codUnavailableReason : "Pay in cash when your order arrives. A COD fee may apply."}</span>
              </span>
            </label>
          </fieldset>
        </section>
      </div>

      <aside className="card h-fit space-y-4 p-5" aria-labelledby="sum-title">
        <h2 id="sum-title" className="text-lg font-semibold text-walnut">
          Order summary
        </h2>
        <div>
          <label htmlFor="coupon" className="label">
            Coupon code
          </label>
          <div className="flex gap-2">
            <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} maxLength={30} className="input" placeholder="Enter code" />
            {appliedCoupon ? (
              <button type="button" className="btn-outline px-3 py-2" onClick={() => { setAppliedCoupon(null); setCouponInput(""); setCouponMsg(null); refresh(null, method); }}>
                Remove
              </button>
            ) : (
              <button type="button" className="btn-outline px-3 py-2" disabled={!couponInput.trim() || quoting} onClick={() => refresh(couponInput.trim(), method)}>
                Apply
              </button>
            )}
          </div>
          {couponMsg && <p className={`mt-1 text-xs ${appliedCoupon ? "text-success" : "text-danger"}`} aria-live="polite">{couponMsg}</p>}
        </div>

        <dl className="space-y-2 text-sm" aria-busy={quoting}>
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(t.subtotalPaise)}</dd></div>
          {t.discountPaise > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>−{formatINR(t.discountPaise)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{t.shippingPaise === 0 ? "Free" : formatINR(t.shippingPaise)}</dd></div>
          {t.codFeePaise > 0 && <div className="flex justify-between"><dt>COD fee</dt><dd>{formatINR(t.codFeePaise)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-walnut"><dt>Total</dt><dd>{formatINR(t.totalPaise)}</dd></div>
        </dl>

        <form action={action} className="space-y-3">
          <input type="hidden" name="address_id" value={addressId} />
          <input type="hidden" name="payment_method" value={method} />
          <input type="hidden" name="coupon_code" value={appliedCoupon ?? ""} />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <div>
            <label htmlFor="note" className="label">Order note (optional)</label>
            <textarea id="note" name="note" maxLength={500} rows={2} className="input" />
          </div>
          {state && !state.ok && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger" role="alert">{state.error}</p>}
          <button type="submit" disabled={submitting || quoting || !addressId || adding || state?.ok === true} className="btn-primary w-full py-3">
            {submitting || state?.ok ? "Placing order…" : method === "cod" ? `Place order · ${formatINR(t.totalPaise)}` : `Continue to payment · ${formatINR(t.totalPaise)}`}
          </button>
          <p className="text-center text-xs text-muted">Prices and stock are re-checked when you place the order.</p>
        </form>
      </aside>
    </div>
  );
}
