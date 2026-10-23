import Link from "next/link";
import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireStaffPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const PAGE = 25;
const FILTERS: Record<string, { label: string; statuses?: OrderStatus[]; payment?: PaymentStatus[] }> = {
  all: { label: "All" },
  pending_payment: { label: "Awaiting payment", statuses: ["pending_payment"] },
  to_fulfil: { label: "To fulfil", statuses: ["confirmed", "processing", "packed"] },
  in_transit: { label: "In transit", statuses: ["shipped", "out_for_delivery"] },
  delivered: { label: "Delivered", statuses: ["delivered"] },
  on_hold: { label: "On hold", statuses: ["on_hold"] },
  refund_due: { label: "Cancelled · refund due", statuses: ["cancelled"], payment: ["paid", "partially_refunded"] },
  cancelled: { label: "Cancelled / failed", statuses: ["cancelled", "payment_failed"] },
  refunded: { label: "Refunded", statuses: ["refunded", "partially_refunded"] },
};

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const filterKey = sp.status && sp.status in FILTERS ? sp.status : "all";
  const filter = FILTERS[filterKey];
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").replace(/[^A-Za-z0-9@.+\- ]/g, "").trim().slice(0, 60);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, status, payment_method, payment_status, total_paise, created_at, contact_phone, contact_email, shipping_address", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (filter.payment) query = query.in("payment_status", filter.payment);
  if (q) query = query.or(`order_number.ilike.%${q}%,contact_phone.ilike.%${q}%,contact_email.ilike.%${q}%,shipping_address->>full_name.ilike.%${q}%`);
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) query = query.gte("created_at", `${sp.from}T00:00:00+05:30`);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) query = query.lte("created_at", `${sp.to}T23:59:59+05:30`);
  const { data, count } = await query;

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...o })) if (v) p.set(k, v);
    return `/admin/orders?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Orders" />
      <div className="mb-4 flex flex-wrap gap-1">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link key={k} href={href({ status: k === "all" ? undefined : k, page: undefined })} className={`rounded-full px-3 py-1 text-sm ${k === filterKey ? "bg-walnut text-ivory" : "bg-white text-walnut hover:bg-almond-100"}`}>
            {f.label}
          </Link>
        ))}
      </div>
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3 text-sm">
        {filterKey !== "all" && <input type="hidden" name="status" value={filterKey} />}
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Order no., phone, email, name" className="input" />
        </div>
        <div>
          <label htmlFor="from" className="label">From</label>
          <input id="from" type="date" name="from" defaultValue={sp.from} className="input" />
        </div>
        <div>
          <label htmlFor="to" className="label">To</label>
          <input id="to" type="date" name="to" defaultValue={sp.to} className="input" />
        </div>
        <button type="submit" className="btn-primary py-2">Filter</button>
      </form>
      <Table>
        <thead>
          <tr><Th>Order</Th><Th>Date</Th><Th>Customer</Th><Th>Status</Th><Th>Payment</Th><Th className="text-right">Total</Th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((o) => (
            <tr key={o.id} className="hover:bg-almond-100/40">
              <Td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-walnut hover:underline">{o.order_number}</Link></Td>
              <Td className="whitespace-nowrap">{new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</Td>
              <Td>
                {(o.shipping_address as { full_name?: string })?.full_name}
                <span className="block text-xs text-muted">{o.contact_phone}</span>
              </Td>
              <Td><StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status as OrderStatus]} /></Td>
              <Td>
                <StatusBadge status={o.payment_status} label={PAYMENT_STATUS_LABELS[o.payment_status as PaymentStatus]} />
                <span className="block text-xs text-muted">{o.payment_method === "cod" ? "COD" : "Online"}</span>
              </Td>
              <Td className="text-right font-semibold">{formatINR(Number(o.total_paise))}</Td>
            </tr>
          ))}
          {!data?.length && (
            <tr><Td className="py-8 text-center text-muted">No orders match.</Td></tr>
          )}
        </tbody>
      </Table>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} hrefFor={(p) => href({ page: String(p) })} />
    </div>
  );
}
