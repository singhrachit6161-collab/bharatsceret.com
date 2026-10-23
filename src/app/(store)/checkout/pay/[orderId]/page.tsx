import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RazorpayPay } from "@/components/store/RazorpayPay";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { isRazorpayConfigured, isRazorpayLiveMode } from "@/lib/server-env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/checkout/pay/${orderId}`);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, total_paise, reservation_expires_at, payment_method")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/checkout/result/${order.id}`);

  const expires = order.reservation_expires_at ? new Date(order.reservation_expires_at) : null;
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md space-y-5 p-6">
        <h1 className="font-display text-2xl font-semibold text-walnut">Complete your payment</h1>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Order</dt><dd className="font-medium">{order.order_number}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="font-semibold text-walnut">{formatINR(Number(order.total_paise))}</dd></div>
          {expires && (
            <div className="flex justify-between">
              <dt className="text-muted">Items reserved until</dt>
              <dd>{expires.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST</dd>
            </div>
          )}
        </dl>
        {isRazorpayConfigured() ? (
          <RazorpayPay orderId={order.id} totalPaise={Number(order.total_paise)} testMode={!isRazorpayLiveMode()} />
        ) : (
          <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">Online payments are not configured on this store. Please contact support.</p>
        )}
        <p className="text-xs text-muted">
          Your cart is kept until payment succeeds. If the payment window expires, reserved items are released.{" "}
          <Link href="/cart" className="underline">Back to cart</Link>
        </p>
      </div>
    </div>
  );
}
