import Link from "next/link";
import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const PAGE = 30;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireStaffPage(ADMIN_ROLES);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 60);
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, slug, status, is_featured, is_bestseller, updated_at, product_variants (id, sku, price_paise, is_active, inventory (on_hand, reserved))", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("name", `%${q}%`);
  if (sp.status && ["draft", "active", "archived"].includes(sp.status)) query = query.eq("status", sp.status);
  const { data, count } = await query;

  type V = { id: string; sku: string; price_paise: number; is_active: boolean; inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null };
  return (
    <div>
      <PageHeader title="Products" actions={<Link href="/admin/products/new" className="btn-primary">New product</Link>} />
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3 text-sm">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Product name" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Any</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
          </select>
        </div>
        <button type="submit" className="btn-primary py-2">Filter</button>
      </form>
      <Table>
        <thead><tr><Th>Product</Th><Th>Status</Th><Th>Variants</Th><Th className="text-right">From</Th><Th className="text-right">Available</Th></tr></thead>
        <tbody>
          {(data ?? []).map((p) => {
            const variants = (p.product_variants ?? []) as V[];
            const active = variants.filter((v) => v.is_active);
            const available = active.reduce((s, v) => {
              const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
              return s + (inv ? inv.on_hand - inv.reserved : 0);
            }, 0);
            const min = active.length ? Math.min(...active.map((v) => Number(v.price_paise))) : null;
            return (
              <tr key={p.id} className="hover:bg-almond-100/40">
                <Td>
                  <Link href={`/admin/products/${p.id}`} className="font-semibold text-walnut hover:underline">{p.name}</Link>
                  <span className="block text-xs text-muted">/{p.slug}{p.is_featured ? " · featured" : ""}{p.is_bestseller ? " · bestseller" : ""}</span>
                </Td>
                <Td><StatusBadge status={p.status === "active" ? "approved" : p.status === "archived" ? "cancelled" : "pending"} label={p.status} /></Td>
                <Td>{active.length}/{variants.length}</Td>
                <Td className="text-right">{min !== null ? formatINR(min) : "—"}</Td>
                <Td className={`text-right font-semibold ${available <= 0 ? "text-danger" : ""}`}>{available}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} hrefFor={(n) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`} />
    </div>
  );
}
