import { saveProduct } from "@/app/admin/actions/catalog";
import type { Category } from "@/lib/types";
import { ActionForm } from "./ActionForm";
import { Check, Field, TextArea } from "./fields";

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  brand: string;
  short_description: string | null;
  description: string | null;
  ingredients: string | null;
  storage_instructions: string | null;
  allergen_info: string | null;
  shelf_life: string | null;
  country_of_origin: string | null;
  manufacturer_info: string | null;
  fssai_license: string | null;
  status: "draft" | "active" | "archived";
  published_at: string | null;
  is_featured: boolean;
  featured_rank: number;
  is_bestseller: boolean;
  bestseller_rank: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);
}

export function ProductForm({ product, categories, selected }: { product?: ProductRow; categories: Category[]; selected: string[] }) {
  return (
    <ActionForm action={saveProduct} submitLabel={product ? "Save product" : "Create product"} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold text-walnut sm:col-span-2">Basics</h2>
        <Field label="Name" name="name" defaultValue={product?.name} required maxLength={160} />
        <Field label="URL slug" name="slug" defaultValue={product?.slug} hint="Leave empty to generate from the name." maxLength={80} />
        <Field label="Brand" name="brand" defaultValue={product?.brand ?? "Bharat Secrets"} required />
        <div>
          <label htmlFor="f-status" className="label">Status</label>
          <select id="f-status" name="status" defaultValue={product?.status ?? "draft"} className="input">
            <option value="draft">Draft (hidden)</option>
            <option value="active">Active (published)</option>
            <option value="archived">Archived (hidden)</option>
          </select>
          <p className="mt-1 text-xs text-muted">Publishing requires the labelling fields below, an active variant and an image.</p>
        </div>
        <Field label="Publish date (IST)" name="published_at" type="datetime-local" defaultValue={toLocalInput(product?.published_at ?? null)} hint="Optional: schedule publication." />
        <TextArea label="Short description" name="short_description" defaultValue={product?.short_description} maxLength={300} className="sm:col-span-2" rows={2} />
        <TextArea label="Description" name="description" defaultValue={product?.description} rows={6} className="sm:col-span-2" />
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold text-walnut">Labelling & food information</h2>
          <p className="text-xs text-muted">Enter only verified information from your packaging and supplier documents. Do not add health claims you cannot substantiate.</p>
        </div>
        <TextArea label="Ingredients" name="ingredients" defaultValue={product?.ingredients} />
        <TextArea label="Allergen information" name="allergen_info" defaultValue={product?.allergen_info} hint="e.g. Contains tree nuts. Packed in a facility that also handles peanuts." />
        <TextArea label="Storage instructions" name="storage_instructions" defaultValue={product?.storage_instructions} />
        <TextArea label="Manufacturer / packer details" name="manufacturer_info" defaultValue={product?.manufacturer_info} />
        <Field label="Shelf life / best before" name="shelf_life" defaultValue={product?.shelf_life} hint="e.g. Best before 6 months from packing" />
        <Field label="Country of origin" name="country_of_origin" defaultValue={product?.country_of_origin} />
        <Field label="FSSAI licence no." name="fssai_license" defaultValue={product?.fssai_license} inputMode="numeric" maxLength={14} pattern="\d{14}" />
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold text-walnut sm:col-span-2">Categories & merchandising</h2>
        <fieldset className="sm:col-span-2">
          <legend className="label">Categories</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="category_ids" value={c.id} defaultChecked={selected.includes(c.id)} className="h-4 w-4 accent-walnut" /> {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <Check label="Featured on homepage" name="is_featured" defaultChecked={product?.is_featured} />
          <Field label="Featured order" name="featured_rank" type="number" min={0} defaultValue={String(product?.featured_rank ?? 0)} />
        </div>
        <div className="space-y-2">
          <Check label="Curated bestseller" name="is_bestseller" defaultChecked={product?.is_bestseller} />
          <Field label="Bestseller order" name="bestseller_rank" type="number" min={0} defaultValue={String(product?.bestseller_rank ?? 0)} hint="If no product is flagged, bestsellers come from real sales." />
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold text-walnut sm:col-span-2">SEO & sharing</h2>
        <Field label="SEO title" name="seo_title" defaultValue={product?.seo_title} maxLength={70} />
        <Field label="Social image URL" name="og_image_url" defaultValue={product?.og_image_url} hint="Defaults to the first product image." />
        <TextArea label="Meta description" name="seo_description" defaultValue={product?.seo_description} maxLength={170} rows={2} className="sm:col-span-2" />
      </section>
    </ActionForm>
  );
}
