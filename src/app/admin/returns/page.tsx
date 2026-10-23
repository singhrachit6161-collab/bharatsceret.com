import Link from "next/link";
import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { requireStaffPage } from "@/lib/auth";
import { RETURN_REASONS, RETURN_STATUS_LABELS, type ReturnReason } from "@/lib/returns";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FILTERS = { open: ["requested", "approved", "received"], closed: ["rejected", "refunded", "closed"] } as const;

export default async function AdminReturnsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireStaffPage();
  const view = (await searchParams).view === "closed" ? "closed" : "open";
  const supabase = await createClient();
  const { data } = await supabase
    .from("return_requests")
    .select("id, reason, status, created_at, order_id, orders (order_number, contact_email)")
    .in("status", [...FILTERS[view]])
    .order("created_at", { ascending: view === "open" })
    .limit(200);
  const rows = (data ?? []) as unknown as { id: string; reason: ReturnReason; status: string; created_at: string; order_id: string; orders: { order_number: string; contact_email: string | null } | null }[];

  return (
    <div className="space-y-6">
      <PageHeader title="Returns" description="Customer return and problem reports. Open requests are listed oldest first." />
      <nav className="flex gap-2" aria-label="Filter returns">
        {(["open", "closed"] as const).map((v) => (
          <Link key={v} href={`/admin/returns?view=${v}`} aria-current={v === view ? "page" : undefined} className={v === view ? "btn-primary py-1.5" : "btn-outline py-1.5"}>
            {v === "open" ? "Open" : "Closed"}
          </Link>
        ))}
      </nav>
      <Table>
        <thead>
          <tr><Th>Requested</Th><Th>Order</Th><Th>Customer</Th><Th>Reason</Th><Th>Status</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</Td>
              <Td><Link href={`/admin/orders/${r.order_id}`} className="font-semibold text-walnut underline">{r.orders?.order_number ?? "Order"}</Link></Td>
              <Td>{r.orders?.contact_email ?? "—"}</Td>
              <Td>{RETURN_REASONS[r.reason] ?? r.reason}</Td>
              <Td>{RETURN_STATUS_LABELS[r.status] ?? r.status}</Td>
            </tr>
          ))}
          {!rows.length && <tr><Td className="text-muted">No {view} return requests.</Td></tr>}
        </tbody>
      </Table>
    </div>
  );
}
