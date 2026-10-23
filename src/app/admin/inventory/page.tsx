import Link from "next/link";
import { adjustStock, setThreshold } from "@/app/admin/actions/inventory";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Row {
  variant_id: string;
  on_hand: number;
  reserved: number;
  low_stock_threshold: number;
  product_variants: { sku: string; label: string; is_active: boolean; products: { id: string; name: string; status: string } };
}

export default async function AdminInventory({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; variant?: string }> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N} -]/gu, "").trim().toLowerCase().slice(0, 60);
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory")
    .select("variant_id, on_hand, reserved, low_stock_threshold, product_variants!inner (sku, label, is_active, products!inner (id, name, status))")
    .limit(2000);
  let rows = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, available: r.on_hand - r.reserved }));
  if (q) rows = rows.filter((r) => r.product_variants.sku.toLowerCase().includes(q) || r.product_variants.products.name.toLowerCase().includes(q));
  if (sp.filter === "low") rows = rows.filter((r) => r.available <= r.low_stock_threshold);
  if (sp.filter === "out") rows = rows.filter((r) => r.available <= 0);
  rows.sort((a, b) => a.product_variants.products.name.localeCompare(b.product_variants.products.name) || a.product_variants.label.localeCompare(b.product_variants.label));

  const selected = sp.variant && /^[0-9a-f-]{36}$/i.test(sp.variant) ? sp.variant : null;
  const { data: movements } = selected
    ? await supabase.from("inventory_movements").select("id, reason, delta_on_hand, delta_reserved, note, created_at, order_id").eq("variant_id", selected).order("created_at", { ascending: false }).limit(50)
    : { data: null };

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" description="Available = on hand − reserved for unpaid online orders. Every change is logged with a reason." />
      <form method="get" className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search SKU or product</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" />
        </div>
        <div>
          <label htmlFor="filter" className="label">Show</label>
          <select id="filter" name="filter" defaultValue={sp.filter ?? ""} className="input">
            <option value="">All</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </select>
        </div>
        <button type="submit" className="btn-primary py-2">Filter</button>
      </form>

      {selected && (
        <section className="card p-4">
          <div className="mb-2 flex justify-between"><h2 className="font-semibold text-walnut">Movement history</h2><Link href="/admin/inventory" className="text-sm underline">Close</Link></div>
          <ul className="divide-y divide-line text-sm">
            {(movements ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong className="capitalize">{m.reason.replace(/_/g, " ")}</strong>{m.note && ` — ${m.note}`}</span>
                <span className="text-xs text-muted">
                  on hand {m.delta_on_hand > 0 ? "+" : ""}{m.delta_on_hand} · reserved {m.delta_reserved > 0 ? "+" : ""}{m.delta_reserved} ·{" "}
                  {new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  {m.order_id && <> · <Link className="underline" href={`/admin/orders/${m.order_id}`}>order</Link></>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Table>
        <thead><tr><Th>Product / variant</Th><Th className="text-right">On hand</Th><Th className="text-right">Reserved</Th><Th className="text-right">Available</Th><Th>Adjust</Th><Th>Low-stock at</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.variant_id}>
              <Td>
                <span className="font-medium">{r.product_variants.products.name}</span> · {r.product_variants.label}
                <span className="block font-mono text-xs text-muted">{r.product_variants.sku}{!r.product_variants.is_active && " · inactive"}{r.product_variants.products.status !== "active" && ` · ${r.product_variants.products.status}`}</span>
                <Link href={`/admin/inventory?variant=${r.variant_id}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} className="text-xs underline">History</Link>
              </Td>
              <Td className="text-right">{r.on_hand}</Td>
              <Td className="text-right">{r.reserved}</Td>
              <Td className={`text-right font-semibold ${r.available <= 0 ? "text-danger" : r.available <= r.low_stock_threshold ? "text-saffron-600" : ""}`}>{r.available}</Td>
              <Td>
                <ActionForm action={adjustStock} submitLabel="Apply" variant="outline" className="flex flex-wrap items-center gap-1.5" resetOnSuccess>
                  <input type="hidden" name="variant_id" value={r.variant_id} />
                  <input name="delta" type="number" step={1} placeholder="±qty" aria-label="Quantity change" required className="input w-20" />
                  <input name="reason" placeholder="Reason" aria-label="Reason" required minLength={3} className="input w-36" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="confirm_large" /> large</label>
                </ActionForm>
              </Td>
              <Td>
                <ActionForm action={setThreshold} submitLabel="Set" variant="outline" className="flex items-center gap-1.5">
                  <input type="hidden" name="variant_id" value={r.variant_id} />
                  <input name="threshold" type="number" min={0} defaultValue={r.low_stock_threshold} aria-label="Low-stock threshold" className="input w-20" />
                </ActionForm>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
