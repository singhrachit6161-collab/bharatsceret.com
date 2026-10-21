import { ExternalLink } from "lucide-react";
import { ProductImage } from "@/components/ui/ProductImage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/money";
import { FULFILMENT_STEPS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipping";
import type { OrderDetail } from "@/lib/types";

export function OrderDetailView({ order }: { order: OrderDetail }) {
  const a = order.shipping_address;
  const stepIndex = FULFILMENT_STEPS.indexOf(order.status);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
        <StatusBadge status={order.payment_status} label={`Payment: ${PAYMENT_STATUS_LABELS[order.payment_status]}`} />
        <span className="text-sm text-muted">Placed {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
      </div>

      {stepIndex >= 0 && (
        <ol className="grid grid-cols-5 gap-1 text-center text-[11px] sm:text-xs" aria-label="Order progress">
          {FULFILMENT_STEPS.map((s, i) => (
            <li key={s} className="space-y-1" aria-current={i === stepIndex ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${i <= stepIndex ? "bg-olive" : "bg-line"}`} />
              <span className={i <= stepIndex ? "font-semibold text-olive" : "text-muted"}>{ORDER_STATUS_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {order.shipments.map((s) => (
        <section key={s.id} className="card p-4 text-sm">
          <h3 className="mb-2 font-semibold text-walnut">Shipment · {SHIPMENT_STATUS_LABELS[s.status] ?? s.status}</h3>
          <p>
            {s.carrier}
            {s.tracking_number && <> · Tracking no. <strong>{s.tracking_number}</strong></>}
          </p>
          {s.tracking_url && (
            <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-saffron-600 hover:underline">
              Track with carrier <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          {!!s.shipment_events?.length && (
            <ol className="mt-3 space-y-1 border-l-2 border-line pl-4">
              {s.shipment_events.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{SHIPMENT_STATUS_LABELS[e.status] ?? e.status}</span>
                  {e.location && ` · ${e.location}`} — <span className="text-muted">{new Date(e.occurred_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
                  {e.description && <p className="text-xs text-muted">{e.description}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <section className="card divide-y divide-line">
        {order.order_items.map((it) => (
          <div key={it.id} className="flex items-center gap-4 p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-almond-100">
              <ProductImage src={it.image_url} alt="" sizes="64px" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium">{it.product_name}</p>
              <p className="text-xs text-muted">{it.variant_label} · SKU {it.sku}</p>
            </div>
            <div className="text-right text-sm">
              <p>{formatINR(Number(it.unit_price_paise))} × {it.quantity}</p>
              <p className="font-semibold">{formatINR(Number(it.line_total_paise))}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="card p-4 text-sm">
          <h3 className="mb-2 font-semibold text-walnut">Delivery address</h3>
          <p className="font-medium">{a.full_name}</p>
          <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
          {a.landmark && <p>Near {a.landmark}</p>}
          <p>{a.city}, {a.state} – {a.pincode}</p>
          <p className="mt-1 text-muted">Phone: {a.phone}</p>
        </section>
        <section className="card p-4 text-sm">
          <h3 className="mb-2 font-semibold text-walnut">Payment summary</h3>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(Number(order.subtotal_paise))}</dd></div>
            {Number(order.discount_paise) > 0 && <div className="flex justify-between text-success"><dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt><dd>−{formatINR(Number(order.discount_paise))}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{Number(order.shipping_paise) === 0 ? "Free" : formatINR(Number(order.shipping_paise))}</dd></div>
            {Number(order.cod_fee_paise) > 0 && <div className="flex justify-between"><dt>COD fee</dt><dd>{formatINR(Number(order.cod_fee_paise))}</dd></div>}
            <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total</dt><dd>{formatINR(Number(order.total_paise))}</dd></div>
            {Number(order.refunded_paise) > 0 && <div className="flex justify-between text-success"><dt>Refunded</dt><dd>{formatINR(Number(order.refunded_paise))}</dd></div>}
            <div className="flex justify-between text-muted"><dt>Method</dt><dd>{order.payment_method === "cod" ? "Cash on delivery" : "Online (Razorpay)"}</dd></div>
          </dl>
        </section>
      </div>
      {order.cancel_reason && <p className="text-sm text-muted">Cancellation reason: {order.cancel_reason}</p>}
    </div>
  );
}
