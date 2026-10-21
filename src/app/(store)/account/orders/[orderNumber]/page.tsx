import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/components/store/CancelOrderButton";
import { OrderDetailView } from "@/components/store/OrderDetailView";
import { requireUser } from "@/lib/auth";
import { getOrderByNumber } from "@/lib/data/orders";

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
          <Link href={`/contact?order=${encodeURIComponent(order.order_number)}`} className="btn-outline">Need help?</Link>
        </div>
      </div>
      <OrderDetailView order={order} />
      {customerCancellable && <CancelOrderButton orderId={order.id} />}
      {order.status === "confirmed" && order.payment_method === "razorpay" && (
        <p className="text-xs text-muted">To cancel a paid order, please contact support — refunds are issued to the original payment method.</p>
      )}
    </div>
  );
}
