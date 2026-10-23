import { deleteCategory, saveCategory } from "@/app/admin/actions/catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { Check, Field, TextArea } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildTree, flattenTree } from "@/lib/category-tree";
import type { Category } from "@/lib/types";

function CategoryFields({ c, all }: { c?: Category; all: Category[] }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" name="name" defaultValue={c?.name} required />
        <Field label="Slug" name="slug" defaultValue={c?.slug} hint="Auto-generated if empty" />
        <Field label="Sort order" name="sort_order" type="number" min={0} defaultValue={String(c?.sort_order ?? 0)} />
        <Field label="Image URL" name="image_url" defaultValue={c?.image_url} placeholder="/placeholders/almonds.svg or https://…" />
        <div>
          <label htmlFor={`parent-${c?.id ?? "new"}`} className="label">Parent</label>
          <select id={`parent-${c?.id ?? "new"}`} name="parent_id" defaultValue={c?.parent_id ?? ""} className="input">
            <option value="">— None —</option>
            {flattenTree(buildTree(all)).filter((x) => x.id !== c?.id).map((x) => (
              <option key={x.id} value={x.id}>{"\u00a0\u00a0".repeat(x.depth)}{x.name}</option>
            ))}
          </select>
        </div>
        <Field label="SEO title" name="seo_title" defaultValue={c?.seo_title} maxLength={70} />
        <TextArea label="Description" name="description" defaultValue={c?.description} rows={2} className="sm:col-span-2" />
        <TextArea label="Meta description" name="seo_description" defaultValue={c?.seo_description} rows={2} maxLength={170} />
      </div>
      <div className="flex gap-6">
        <Check label="Visible" name="is_visible" defaultChecked={c?.is_visible ?? true} />
        <Check label="Show in menus" name="show_in_nav" defaultChecked={c?.show_in_nav ?? false} />
      </div>
    </>
  );
}

export default async function AdminCategories() {
  await requireStaffPage(ADMIN_ROLES);
  const supabase = await createClient();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("product_categories").select("category_id"),
  ]);
  const all = (data ?? []) as Category[];
  const usage = new Map<string, number>();
  for (const r of counts ?? []) usage.set(r.category_id, (usage.get(r.category_id) ?? 0) + 1);

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Collections" description="The catalogue tree. Top-level collections with “Show in menus” appear in the main menu; their children with the flag appear in its dropdown. Categories in use cannot be deleted — hide them instead." />
      {flattenTree(buildTree(all)).map((c) => (
        <details key={c.id} className="card p-4" style={{ marginLeft: c.depth * 28 }}>
          <summary className="flex cursor-pointer flex-wrap justify-between gap-2 text-sm">
            <span>{c.depth > 0 && <span className="mr-1 text-saffron">└</span>}<strong className={c.depth === 0 ? "font-display text-lg" : ""}>{c.name}</strong> <span className="text-muted">/{c.slug}</span>{!c.is_visible && <span className="ml-2 text-danger">hidden</span>}</span>
            <span className="text-xs text-muted">{usage.get(c.id) ?? 0} products · order {c.sort_order}</span>
          </summary>
          <div className="mt-4 space-y-3">
            <ActionForm action={saveCategory} submitLabel="Save category"><CategoryFields c={c} all={all} /></ActionForm>
            <ActionForm action={deleteCategory} submitLabel="Delete category" variant="outline"><input type="hidden" name="id" value={c.id} /></ActionForm>
          </div>
        </details>
      ))}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-walnut">+ New category</summary>
        <div className="mt-4"><ActionForm action={saveCategory} submitLabel="Create category" resetOnSuccess><CategoryFields all={all} /></ActionForm></div>
      </details>
    </div>
  );
}
