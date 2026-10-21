import type { Metadata } from "next";
import { OrderList } from "@/components/store/OrderList";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Order history", robots: { index: false } };
const PAGE = 20;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const user = await requireUser("/account/orders");
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_method, payment_status, total_paise, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  return (
    <div>
      <h1 className="section-title mb-6">Order history</h1>
      {data?.length ? (
        <OrderList orders={data as OrderSummary[]} />
      ) : (
        <EmptyState title="No orders yet" description="When you place an order it will appear here." actionHref="/shop" actionLabel="Start shopping" />
      )}
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} hrefFor={(p) => `/account/orders?page=${p}`} />
    </div>
  );
}
