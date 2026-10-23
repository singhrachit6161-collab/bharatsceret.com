import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order status", robots: { index: false } };

export default async function ResultPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/checkout/result/${orderId}`);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, total_paise")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) notFound();

  const confirmed = ["confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"].includes(order.status);
  const pending = order.status === "pending_payment" || order.status === "on_hold";
  return (
    <div className="container-page flex justify-center py-14">
      <div className="card w-full max-w-lg p-8 text-center">
        {confirmed ? (
          <>
            <CheckCircle2 size={56} className="mx-auto text-success" aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-semibold text-walnut">Thank you! Order confirmed</h1>
            <p className="mt-2 text-sm text-muted">
              Order <strong>{order.order_number}</strong> · {formatINR(Number(order.total_paise))}
              {order.payment_status === "paid" && " · Payment received"}
            </p>
          </>
        ) : pending ? (
          <>
            <Clock size={56} className="mx-auto text-saffron" aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-semibold text-walnut">
              {order.status === "on_hold" ? "Payment received — under review" : "Confirming your payment…"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {order.status === "on_hold"
                ? "Our team will contact you shortly about this order."
                : "This usually takes a few seconds. This page refreshes automatically. If you were charged, your order will be confirmed — you do not need to pay again."}
            </p>
            {order.status === "pending_payment" && (
              <>
                <AutoRefresh seconds={5} />
                <Link href={`/checkout/pay/${order.id}`} className="btn-outline mt-4">Retry payment</Link>
              </>
            )}
          </>
        ) : (
          <>
            <XCircle size={56} className="mx-auto text-danger" aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-semibold text-walnut">Payment not completed</h1>
            <p className="mt-2 text-sm text-muted">Order {order.order_number} was not paid and reserved items have been released. Your cart is still saved.</p>
            <Link href="/cart" className="btn-primary mt-6">Return to cart</Link>
          </>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/account/orders/${encodeURIComponent(order.order_number)}`} className="btn-outline">View order</Link>
          <Link href="/shop" className="btn-ghost">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
