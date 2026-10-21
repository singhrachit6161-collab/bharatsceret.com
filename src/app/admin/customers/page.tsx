import Link from "next/link";
import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { requireStaffPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const PAGE = 50;

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").replace(/[%_\\]/g, "").trim().slice(0, 60);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_customers", { p_search: q || null, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const rows = (data ?? []) as { user_id: string; full_name: string | null; phone: string | null; email: string; joined_at: string; order_count: number; paid_total_paise: number; last_order_at: string | null; total_count: number }[];
  return (
    <div>
      <PageHeader title="Customers" description="Account details shown here are limited to what is needed for support and fulfilment. Passwords are never visible to staff." />
      <form method="get" className="card mb-4 flex items-end gap-3 p-3 text-sm">
        <div className="flex-1">
          <label htmlFor="q" className="label">Search name, phone or email</label>
          <input id="q" name="q" defaultValue={q} className="input" />
        </div>
        <button type="submit" className="btn-primary py-2">Search</button>
      </form>
      {error ? (
        <p className="text-danger">Could not load customers.</p>
      ) : (
        <Table>
          <thead><tr><Th>Customer</Th><Th>Joined</Th><Th className="text-right">Orders</Th><Th className="text-right">Paid total</Th><Th>Last order</Th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.user_id}>
                <Td>
                  <span className="font-medium">{c.full_name || "—"}</span>
                  <span className="block text-xs text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
                </Td>
                <Td>{new Date(c.joined_at).toLocaleDateString("en-IN")}</Td>
                <Td className="text-right">{c.order_count > 0 ? <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="underline">{c.order_count}</Link> : 0}</Td>
                <Td className="text-right">{formatINR(Number(c.paid_total_paise))}</Td>
                <Td>{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-IN") : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} total={Number(rows[0]?.total_count ?? 0)} pageSize={PAGE} hrefFor={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </div>
  );
}
