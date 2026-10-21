import { saveCoupon } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { Check, Field } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { formatINR, paiseToRupeesString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

interface Coupon {
  id: string; code: string; description: string | null; discount_type: "percentage" | "fixed"; discount_value: number;
  max_discount_paise: number | null; min_order_paise: number; starts_at: string | null; ends_at: string | null;
  usage_limit: number | null; per_customer_limit: number | null; used_count: number; scope: "all" | "products" | "categories"; is_active: boolean;
  coupon_products: { product_id: string }[]; coupon_categories: { category_id: string }[];
}
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : "");

function CouponFields({ c, products, categories }: { c?: Coupon; products: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const selP = new Set(c?.coupon_products.map((p) => p.product_id));
  const selC = new Set(c?.coupon_categories.map((p) => p.category_id));
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Code" name="code" defaultValue={c?.code} required />
        <div>
          <label className="label" htmlFor={`dt-${c?.id ?? "new"}`}>Type</label>
          <select id={`dt-${c?.id ?? "new"}`} name="discount_type" defaultValue={c?.discount_type ?? "percentage"} className="input">
            <option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option>
          </select>
        </div>
        <Field label="Value (% or ₹)" name="discount_value" defaultValue={c ? (c.discount_type === "percentage" ? String(c.discount_value) : paiseToRupeesString(Number(c.discount_value))) : ""} required />
        <Field label="Max discount (₹)" name="max_discount" defaultValue={c?.max_discount_paise ? paiseToRupeesString(Number(c.max_discount_paise)) : ""} />
        <Field label="Minimum order (₹)" name="min_order" defaultValue={c ? paiseToRupeesString(Number(c.min_order_paise)) : "0"} />
        <Field label="Description" name="description" defaultValue={c?.description} />
        <Field label="Starts (IST)" name="starts_at" type="datetime-local" defaultValue={toLocal(c?.starts_at ?? null)} />
        <Field label="Ends (IST)" name="ends_at" type="datetime-local" defaultValue={toLocal(c?.ends_at ?? null)} />
        <div />
        <Field label="Total usage limit" name="usage_limit" type="number" min={1} defaultValue={c?.usage_limit ? String(c.usage_limit) : ""} />
        <Field label="Per-customer limit" name="per_customer_limit" type="number" min={1} defaultValue={c?.per_customer_limit ? String(c.per_customer_limit) : ""} />
        <div>
          <label className="label" htmlFor={`sc-${c?.id ?? "new"}`}>Applies to</label>
          <select id={`sc-${c?.id ?? "new"}`} name="scope" defaultValue={c?.scope ?? "all"} className="input">
            <option value="all">Whole cart</option><option value="categories">Selected categories</option><option value="products">Selected products</option>
          </select>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-walnut">Eligible categories / products</summary>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <fieldset><legend className="label">Categories</legend>
            <div className="max-h-48 space-y-1 overflow-y-auto">{categories.map((x) => <label key={x.id} className="flex gap-2"><input type="checkbox" name="category_ids" value={x.id} defaultChecked={selC.has(x.id)} /> {x.name}</label>)}</div>
          </fieldset>
          <fieldset><legend className="label">Products</legend>
            <div className="max-h-48 space-y-1 overflow-y-auto">{products.map((x) => <label key={x.id} className="flex gap-2"><input type="checkbox" name="product_ids" value={x.id} defaultChecked={selP.has(x.id)} /> {x.name}</label>)}</div>
          </fieldset>
        </div>
      </details>
      <Check label="Active" name="is_active" defaultChecked={c?.is_active ?? true} />
    </>
  );
}

export default async function AdminCoupons() {
  await requireStaffPage(ADMIN_ROLES);
  const supabase = await createClient();
  const [{ data }, { data: products }, { data: categories }] = await Promise.all([
    supabase.from("coupons").select("*, coupon_products (product_id), coupon_categories (category_id)").order("created_at", { ascending: false }),
    supabase.from("products").select("id, name").neq("status", "archived").order("name"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Coupons" description="Discounts are always recalculated and limits enforced on the server at checkout." />
      {((data ?? []) as Coupon[]).map((c) => (
        <details key={c.id} className="card p-4">
          <summary className="flex cursor-pointer flex-wrap justify-between gap-2 text-sm">
            <span><strong className="font-mono">{c.code}</strong> · {c.discount_type === "percentage" ? `${c.discount_value}%` : formatINR(Number(c.discount_value))}{!c.is_active && <span className="ml-2 text-danger">inactive</span>}</span>
            <span className="text-xs text-muted">used {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ""}{c.ends_at ? ` · ends ${new Date(c.ends_at).toLocaleDateString("en-IN")}` : ""}</span>
          </summary>
          <div className="mt-4"><ActionForm action={saveCoupon} submitLabel="Save coupon"><CouponFields c={c} products={products ?? []} categories={categories ?? []} /></ActionForm></div>
        </details>
      ))}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-walnut">+ New coupon</summary>
        <div className="mt-4"><ActionForm action={saveCoupon} submitLabel="Create coupon" resetOnSuccess><CouponFields products={products ?? []} categories={categories ?? []} /></ActionForm></div>
      </details>
    </div>
  );
}
