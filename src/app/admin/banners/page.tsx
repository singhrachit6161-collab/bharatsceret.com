import { deleteBanner, saveBanner, saveSection } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { Check, Field } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Banner, HomepageSection } from "@/lib/types";

type BannerRow = Banner & { is_active: boolean; starts_at: string | null; ends_at: string | null };
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : "");
const PLACEMENTS = { hero: "Hero carousel", category_tile: "Category tiles (4)", promo: "Promotional banners" } as const;

function BannerFields({ b, placement }: { b?: BannerRow; placement: Banner["placement"] }) {
  return (
    <>
      {b && <input type="hidden" name="id" value={b.id} />}
      <input type="hidden" name="placement" value={placement} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Title" name="title" defaultValue={b?.title} required />
        <Field label="Subtitle" name="subtitle" defaultValue={b?.subtitle} />
        <Field label="Button label" name="cta_label" defaultValue={b?.cta_label} />
        <Field label="Link (site path)" name="link_url" defaultValue={b?.link_url ?? "/shop"} required />
        <Field label="Image URL" name="image_url" defaultValue={b?.image_url} required hint="Upload to Storage or use /public path" />
        <Field label="Mobile image URL" name="mobile_image_url" defaultValue={b?.mobile_image_url} />
        <Field label="Alt text" name="alt" defaultValue={b?.alt} />
        <div>
          <label className="label" htmlFor={`th-${b?.id ?? placement}`}>Theme</label>
          <select id={`th-${b?.id ?? placement}`} name="theme" defaultValue={b?.theme ?? "walnut"} className="input">
            <option value="walnut">Walnut</option><option value="saffron">Saffron</option><option value="olive">Olive</option><option value="cream">Cream</option>
          </select>
        </div>
        <Field label="Order" name="sort_order" type="number" min={0} defaultValue={String(b?.sort_order ?? 0)} />
        <Field label="Show from (IST)" name="starts_at" type="datetime-local" defaultValue={toLocal(b?.starts_at ?? null)} />
        <Field label="Show until (IST)" name="ends_at" type="datetime-local" defaultValue={toLocal(b?.ends_at ?? null)} hint="Expired banners hide automatically." />
      </div>
      <Check label="Active" name="is_active" defaultChecked={b?.is_active ?? true} />
    </>
  );
}

export default async function AdminBanners() {
  await requireStaffPage(ADMIN_ROLES);
  const supabase = await createClient();
  const [{ data: banners }, { data: sections }] = await Promise.all([
    supabase.from("homepage_banners").select("*").order("sort_order"),
    supabase.from("homepage_sections").select("*").order("sort_order"),
  ]);
  const all = (banners ?? []) as BannerRow[];
  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title="Homepage" description="Banners, category tiles and the order of homepage sections." />
      <section>
        <h2 className="mb-3 text-lg font-semibold text-walnut">Sections</h2>
        <div className="space-y-2">
          {((sections ?? []) as HomepageSection[]).map((s) => (
            <ActionForm key={s.key} action={saveSection} submitLabel="Save" variant="outline" className="card flex flex-wrap items-end gap-3 p-3">
              <input type="hidden" name="key" value={s.key} />
              <span className="w-32 text-xs font-mono text-muted">{s.key}</span>
              <Field label="Title" name="title" defaultValue={s.title} />
              <Field label="Order" name="sort_order" type="number" defaultValue={String(s.sort_order)} className="w-24" />
              <Field label="Items" name="item_limit" type="number" min={1} max={24} defaultValue={String(s.item_limit)} className="w-24" />
              <Check label="Visible" name="is_visible" defaultChecked={s.is_visible} />
            </ActionForm>
          ))}
        </div>
      </section>
      {(Object.keys(PLACEMENTS) as Banner["placement"][]).map((placement) => (
        <section key={placement} className="space-y-2">
          <h2 className="text-lg font-semibold text-walnut">{PLACEMENTS[placement]}</h2>
          {all.filter((b) => b.placement === placement).map((b) => (
            <details key={b.id} className="card p-4">
              <summary className="cursor-pointer text-sm"><strong>{b.title}</strong> → {b.link_url}{!b.is_active && <span className="ml-2 text-danger">inactive</span>}</summary>
              <div className="mt-4 space-y-2">
                <ActionForm action={saveBanner} submitLabel="Save banner"><BannerFields b={b} placement={placement} /></ActionForm>
                <ActionForm action={deleteBanner} submitLabel="Delete" variant="outline"><input type="hidden" name="id" value={b.id} /></ActionForm>
              </div>
            </details>
          ))}
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-semibold text-walnut">+ Add</summary>
            <div className="mt-4"><ActionForm action={saveBanner} submitLabel="Add banner" resetOnSuccess><BannerFields placement={placement} /></ActionForm></div>
          </details>
        </section>
      ))}
    </div>
  );
}
