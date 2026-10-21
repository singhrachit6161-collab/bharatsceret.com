import { saveContentPage } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { Field, TextArea } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const SLUGS = ["about", "shipping-policy", "returns-policy", "privacy-policy", "terms", "faq"];

export default async function AdminContent() {
  await requireStaffPage(ADMIN_ROLES);
  const supabase = await createClient();
  const { data } = await supabase.from("content_pages").select("slug, title, body, updated_at");
  const bySlug = new Map((data ?? []).map((p) => [p.slug, p]));
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="Pages & policies" description="Format: blank line between paragraphs, '## ' for headings, '- ' for list items. Have policies reviewed by a legal advisor." />
      {SLUGS.map((slug) => {
        const p = bySlug.get(slug);
        return (
          <details key={slug} className="card p-4">
            <summary className="cursor-pointer text-sm"><strong>{p?.title ?? slug}</strong> <span className="text-muted">/{slug}</span>{p?.body.includes("TEMPLATE") && <span className="ml-2 text-danger">template text — review before launch</span>}</summary>
            <div className="mt-4">
              <ActionForm action={saveContentPage} submitLabel="Save page">
                <input type="hidden" name="slug" value={slug} />
                <Field label="Title" name="title" defaultValue={p?.title ?? ""} required />
                <TextArea label="Content" name="body" defaultValue={p?.body ?? ""} rows={16} />
              </ActionForm>
            </div>
          </details>
        );
      })}
    </div>
  );
}
