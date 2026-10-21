import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOrderByNumber } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const user = await getSessionUser();
  let notFoundMsg = false;
  if (order && user) {
    const o = await getOrderByNumber(order.trim().toUpperCase().slice(0, 40));
    if (o && o.user_id === user.id) redirect(`/account/orders/${encodeURIComponent(o.order_number)}`);
    notFoundMsg = true;
  }
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6">
        <h1 className="font-display text-3xl font-semibold text-walnut">Track your order</h1>
        {user ? (
          <form method="get" className="mt-5 space-y-3">
            <label htmlFor="order" className="label">Order number</label>
            <input id="order" name="order" defaultValue={order} placeholder="e.g. BS261021-1001" required className="input" />
            {notFoundMsg && <p className="text-sm text-danger" role="alert">We couldn&apos;t find that order on your account.</p>}
            <button type="submit" className="btn-primary w-full">Track</button>
          </form>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">Sign in to see live status and tracking for all your orders.</p>
            <a href="/login?next=/account/orders" className="btn-primary mt-5 w-full">Sign in to track</a>
          </>
        )}
      </div>
    </div>
  );
}
