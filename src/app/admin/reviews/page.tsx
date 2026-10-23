import Link from "next/link";
import { moderateReview } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stars } from "@/components/ui/Stars";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(sp.status ?? "") ? sp.status! : "pending";
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_reviews")
    .select("id, rating, title, body, author_name, status, is_verified_purchase, moderation_note, created_at, products (name, slug)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Reviews" description="Only approved reviews are public. Ratings shown on products are computed from approved reviews only." />
      <div className="mb-4 flex gap-1">
        {["pending", "approved", "rejected"].map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} className={`rounded-full px-3 py-1 text-sm capitalize ${s === status ? "bg-walnut text-ivory" : "bg-white text-walnut"}`}>{s}</Link>
        ))}
      </div>
      <ul className="space-y-3">
        {(data ?? []).map((r) => {
          const p = r.products as unknown as { name: string; slug: string } | null;
          return (
            <li key={r.id} className="card space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><Stars rating={r.rating} /> <strong className="ml-2">{p?.name}</strong></span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {r.is_verified_purchase && <StatusBadge status="approved" label="Verified purchase" />}
                  {new Date(r.created_at).toLocaleDateString("en-IN")} · {r.author_name}
                </span>
              </div>
              {r.title && <p className="font-semibold">{r.title}</p>}
              <p className="whitespace-pre-line">{r.body}</p>
              {r.moderation_note && <p className="text-xs text-muted">Note: {r.moderation_note}</p>}
              <div className="flex flex-wrap gap-2">
                {(["approved", "rejected"] as const).filter((s) => s !== r.status).map((s) => (
                  <ActionForm key={s} action={moderateReview} submitLabel={s === "approved" ? "Approve" : "Reject"} variant={s === "approved" ? "primary" : "outline"} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={s} />
                    {s === "rejected" && <input name="note" placeholder="Reason (internal)" className="input w-48" />}
                  </ActionForm>
                ))}
              </div>
            </li>
          );
        })}
        {!data?.length && <li className="card p-6 text-center text-sm text-muted">No {status} reviews.</li>}
      </ul>
    </div>
  );
}
