import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/components/store/CancelOrderButton";
import { OrderDetailView } from "@/components/store/OrderDetailView";
import { ReturnRequestForm } from "@/components/store/ReturnRequestForm";
import { ReturnRequestsList } from "@/components/store/ReturnRequestsList";
import { requireUser } from "@/lib/auth";
import { invoiceReady } from "@/lib/data/invoices";
import { getOrderByNumber } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { OPEN_RETURN_STATUSES, returnDaysLeft } from "@/lib/returns";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [{ orderNumber }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser("/account/orders");
  const order = await getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order || order.user_id !== user.id) notFound();
  const settings = await getSettings();
  const returns = order.return_requests ?? [];
  const daysLeft = settings.returns.enabled ? returnDaysLeft(order, settings.returns.window_days) : null;
  const canReturn = daysLeft !== null && !returns.some((r) => OPEN_RETURN_STATUSES.includes(r.status));
  const customerCancellable = order.status === "pending_payment" || (order.status === "confirmed" && order.payment_method === "cod");

  return (
    <div className="space-y-6">
      {sp.placed && (
        <div className="rounded-md bg-success/10 p-4 text-sm text-success" role="status">
          Thank you! Your order has been placed{order.payment_method === "cod" ? " — please keep the exact amount ready for cash on delivery." : "."}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Order {order.order_number}</h1>
        <div className="flex gap-2">
          {order.status === "pending_payment" && (
            <Link href={`/checkout/pay/${order.id}`} className="btn-primary">Complete payment</Link>
          )}
          {invoiceReady(order) && (
            <Link href={`/account/orders/${encodeURIComponent(order.order_number)}/invoice`} className="btn-outline">Invoice</Link>
          )}
          <Link href={`/contact?order=${encodeURIComponent(order.order_number)}`} className="btn-outline">Need help?</Link>
        </div>
      </div>
      <OrderDetailView order={order} />
      <ReturnRequestsList requests={returns} items={order.order_items} />
      {canReturn && (
        <ReturnRequestForm
          orderId={order.id}
          daysLeft={daysLeft}
          policyNote={settings.returns.policy_note}
          items={order.order_items.map((i) => ({ id: i.id, name: i.product_name, label: i.variant_label, quantity: i.quantity }))}
        />
      )}
      {customerCancellable && <CancelOrderButton orderId={order.id} />}
      {order.status === "confirmed" && order.payment_method === "razorpay" && (
        <p className="text-xs text-muted">To cancel a paid order, please contact support — refunds are issued to the original payment method.</p>
      )}
    </div>
  );
}
