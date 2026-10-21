import Link from "next/link";
import { PageHeader, Stat, Table, Td, Th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireStaffPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import type { OrderSummary } from "@/lib/types";

interface Dashboard {
  orders_count: number;
  paid_orders: number;
  sales_paise: number;
  cod_outstanding_paise: number;
  refunded_paise: number;
  pending_payment: number;
  pending_fulfilment: number;
  on_hold: number;
  refund_required: number;
  low_stock: { variant_id: string; sku: string; label: string; product_name: string; product_id: string; available: number; low_stock_threshold: number }[];
  bestsellers: { product_id: string; product_name: string; units: number; revenue_paise: number }[];
}

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = new Date(`${s}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}
const ymd = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const now = new Date();
  const from = parseDate(sp.from, new Date(now.getTime() - 29 * 86400_000));
  const toDay = parseDate(sp.to, now);
  const toExclusive = new Date(parseDate(ymd(toDay), toDay).getTime() + 86400_000);

  const supabase = await createClient();
  const [{ data, error }, { data: recent }] = await Promise.all([
    supabase.rpc("admin_dashboard", { p_from: from.toISOString(), p_to: toExclusive.toISOString() }),
    supabase
      .from("orders")
      .select("id, order_number, status, payment_method, payment_status, total_paise, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (error || !data) return <p className="text-danger">Could not load dashboard.</p>;
  const d = data as Dashboard;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Sales count only orders with confirmed payment (online paid or COD collected), net of refunds." />
      <form method="get" className="card flex flex-wrap items-end gap-3 p-4 text-sm">
        <div>
          <label htmlFor="from" className="label">From</label>
          <input id="from" type="date" name="from" defaultValue={ymd(from)} className="input" />
        </div>
        <div>
          <label htmlFor="to" className="label">To</label>
          <input id="to" type="date" name="to" defaultValue={ymd(toDay)} className="input" />
        </div>
        <button type="submit" className="btn-primary py-2">Apply</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net sales (confirmed)" value={formatINR(Number(d.sales_paise))} hint={`${d.paid_orders} paid orders in range`} />
        <Stat label="Orders" value={d.orders_count} hint="Excludes unpaid online orders" />
        <Stat label="COD outstanding" value={formatINR(Number(d.cod_outstanding_paise))} hint="Not yet collected" />
        <Stat label="Refunded" value={formatINR(Number(d.refunded_paise))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting payment" value={d.pending_payment} href="/admin/orders?status=pending_payment" />
        <Stat label="To fulfil" value={d.pending_fulfilment} href="/admin/orders?status=to_fulfil" />
        <Stat label="On hold" value={d.on_hold} href="/admin/orders?status=on_hold" />
        <Stat label="Cancelled, refund due" value={d.refund_required} href="/admin/orders?status=refund_due" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-walnut">Low stock</h2>
          {d.low_stock.length ? (
            <Table>
              <thead><tr><Th>Product</Th><Th>SKU</Th><Th className="text-right">Available</Th><Th className="text-right">Threshold</Th></tr></thead>
              <tbody>
                {d.low_stock.map((r) => (
                  <tr key={r.variant_id}>
                    <Td><Link href={`/admin/inventory?q=${encodeURIComponent(r.sku)}`} className="hover:underline">{r.product_name} · {r.label}</Link></Td>
                    <Td className="font-mono text-xs">{r.sku}</Td>
                    <Td className={`text-right font-semibold ${r.available <= 0 ? "text-danger" : "text-saffron-600"}`}>{r.available}</Td>
                    <Td className="text-right">{r.low_stock_threshold}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="card p-4 text-sm text-muted">All active variants are above their thresholds.</p>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-walnut">Bestsellers in range</h2>
          {d.bestsellers.length ? (
            <Table>
              <thead><tr><Th>Product</Th><Th className="text-right">Units</Th><Th className="text-right">Revenue</Th></tr></thead>
              <tbody>
                {d.bestsellers.map((b) => (
                  <tr key={b.product_id ?? b.product_name}>
                    <Td>{b.product_name}</Td>
                    <Td className="text-right">{b.units}</Td>
                    <Td className="text-right">{formatINR(Number(b.revenue_paise))}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="card p-4 text-sm text-muted">No confirmed orders in this range.</p>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-walnut">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-saffron-600">All orders →</Link>
        </div>
        <Table>
          <thead><tr><Th>Order</Th><Th>Date</Th><Th>Status</Th><Th>Payment</Th><Th className="text-right">Total</Th></tr></thead>
          <tbody>
            {((recent ?? []) as OrderSummary[]).map((o) => (
              <tr key={o.id}>
                <Td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-walnut hover:underline">{o.order_number}</Link></Td>
                <Td>{new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</Td>
                <Td><StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status]} /></Td>
                <Td><StatusBadge status={o.payment_status} /></Td>
                <Td className="text-right">{formatINR(Number(o.total_paise))}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
