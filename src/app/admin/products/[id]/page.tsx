import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteVariant, saveVariant, updateImage, uploadProductImage } from "@/app/admin/actions/catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { Check, Field } from "@/components/admin/fields";
import { ProductForm, type ProductRow } from "@/components/admin/ProductForm";
import { AdminCrumbs, PageHeader } from "@/components/admin/ui";
import { ProductImage } from "@/components/ui/ProductImage";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { paiseToRupeesString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

interface VariantRow {
  id: string;
  sku: string;
  label: string;
  weight_grams: number | null;
  price_paise: number;
  compare_at_paise: number | null;
  is_active: boolean;
  sort_order: number;
  max_per_order: number;
  inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null;
}

function VariantFields({ productId, v }: { productId: string; v?: VariantRow }) {
  return (
    <>
      <input type="hidden" name="product_id" value={productId} />
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="SKU" name="sku" defaultValue={v?.sku} required />
        <Field label="Pack label" name="label" defaultValue={v?.label} placeholder="250 g" required />
        <Field label="Net weight (g)" name="weight_grams" defaultValue={v?.weight_grams ? String(v.weight_grams) : ""} inputMode="numeric" />
        <Field label="Price (₹)" name="price" defaultValue={v ? paiseToRupeesString(Number(v.price_paise)) : ""} inputMode="decimal" required />
        <Field label="Compare-at (₹)" name="compare_at" defaultValue={v?.compare_at_paise ? paiseToRupeesString(Number(v.compare_at_paise)) : ""} inputMode="decimal" hint="Only a genuine previous/MRP price." />
        <Field label="Max per order" name="max_per_order" type="number" min={1} max={100} defaultValue={String(v?.max_per_order ?? 10)} />
        <Field label="Sort order" name="sort_order" type="number" min={0} defaultValue={String(v?.sort_order ?? 0)} />
        {!v && <Field label="Initial stock" name="initial_stock" type="number" min={0} defaultValue="0" />}
      </div>
      <Check label="Active (purchasable)" name="is_active" defaultChecked={v?.is_active ?? true} />
    </>
  );
}

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireStaffPage(ADMIN_ROLES);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_categories (category_id), product_images (id, url, alt, sort_order, storage_path), product_variants (id, sku, label, weight_grams, price_paise, compare_at_paise, is_active, sort_order, max_per_order, inventory (on_hand, reserved))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
  ]);
  if (!product) notFound();
  const variants = ((product.product_variants ?? []) as VariantRow[]).sort((a, b) => a.sort_order - b.sort_order);
  const images = ((product.product_images ?? []) as { id: string; url: string; alt: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
  const selected = ((product.product_categories ?? []) as { category_id: string }[]).map((c) => c.category_id);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <AdminCrumbs items={[{ name: "Products", href: "/admin/products" }, { name: product.name }]} />
        <PageHeader
          title={product.name}
          actions={product.status === "active" ? <Link href={`/product/${product.slug}`} className="btn-outline" target="_blank">View on store</Link> : undefined}
        />
        {sp.created && <p className="rounded-md bg-success/10 p-3 text-sm text-success">Product created as {product.status}. Add variants and images, then publish.</p>}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-walnut">Variants & pricing</h2>
        <p className="text-xs text-muted">Stock levels are changed from <Link href="/admin/inventory" className="underline">Inventory</Link> so every change is logged.</p>
        {variants.map((v) => {
          const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
          return (
            <details key={v.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span><strong>{v.label}</strong> · <span className="font-mono text-xs">{v.sku}</span> · ₹{paiseToRupeesString(Number(v.price_paise))}{!v.is_active && <span className="ml-2 text-danger">inactive</span>}</span>
                <span className="text-xs text-muted">On hand {inv?.on_hand ?? 0} · reserved {inv?.reserved ?? 0}</span>
              </summary>
              <div className="mt-4 space-y-4">
                <ActionForm action={saveVariant} submitLabel="Save variant">
                  <VariantFields productId={product.id} v={v} />
                </ActionForm>
                <ActionForm action={deleteVariant} submitLabel="Delete variant" variant="outline" pendingLabel="Deleting…">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="product_id" value={product.id} />
                </ActionForm>
              </div>
            </details>
          );
        })}
        <details className="card p-4" open={variants.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-walnut">+ Add variant</summary>
          <div className="mt-4">
            <ActionForm action={saveVariant} submitLabel="Add variant" resetOnSuccess>
              <VariantFields productId={product.id} />
            </ActionForm>
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-walnut">Images</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="card overflow-hidden">
              <div className="relative aspect-square bg-almond-100">
                <ProductImage src={img.url} alt={img.alt} sizes="300px" />
                {i === 0 && <span className="absolute top-2 left-2 rounded bg-walnut px-2 py-0.5 text-xs text-ivory">Main</span>}
              </div>
              <div className="space-y-2 p-3">
                <ActionForm action={updateImage} submitLabel="Save alt text" variant="outline" className="space-y-2">
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="product_id" value={product.id} />
                  <input type="hidden" name="op" value="alt" />
                  <input name="alt" defaultValue={img.alt} placeholder="Describe the image" aria-label="Alt text" className="input" />
                </ActionForm>
                <div className="flex flex-wrap gap-2">
                  {(["up", "down", "delete"] as const).map((op) => (
                    <ActionForm key={op} action={updateImage} submitLabel={op === "up" ? "↑ Earlier" : op === "down" ? "↓ Later" : "Delete"} variant={op === "delete" ? "danger" : "outline"} className="inline">
                      <input type="hidden" name="id" value={img.id} />
                      <input type="hidden" name="product_id" value={product.id} />
                      <input type="hidden" name="op" value={op} />
                    </ActionForm>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="card p-4">
          <ActionForm action={uploadProductImage} submitLabel="Upload image" pendingLabel="Uploading…" resetOnSuccess>
            <input type="hidden" name="product_id" value={product.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="img-file" className="label">Image file</label>
                <input id="img-file" type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="block w-full text-sm" />
                <p className="mt-1 text-xs text-muted">JPEG, PNG, WebP or AVIF · max 5 MB · square images look best. Use only photos you own or have licensed.</p>
              </div>
              <Field label="Alt text" name="alt" placeholder="e.g. 250 g pack of California almonds" />
            </div>
          </ActionForm>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-walnut">Product details</h2>
        <ProductForm product={product as ProductRow} categories={(categories ?? []) as Category[]} selected={selected} />
      </section>
    </div>
  );
}
