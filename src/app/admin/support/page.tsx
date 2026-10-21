import Link from "next/link";
import { updateSupportRequest } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const status = ["open", "in_progress", "resolved", "closed"].includes(sp.status ?? "") ? sp.status! : "open";
  const supabase = await createClient();
  const { data } = await supabase.from("support_requests").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Support requests" />
      <div className="mb-4 flex gap-1">
        {["open", "in_progress", "resolved", "closed"].map((s) => (
          <Link key={s} href={`/admin/support?status=${s}`} className={`rounded-full px-3 py-1 text-sm ${s === status ? "bg-walnut text-ivory" : "bg-white text-walnut"}`}>{s.replace("_", " ")}</Link>
        ))}
      </div>
      <ul className="space-y-3">
        {(data ?? []).map((r) => (
          <li key={r.id} className="card space-y-2 p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{r.subject}</strong>
              <span className="text-xs text-muted">{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
            </div>
            <p className="text-xs text-muted">
              {r.name} · <a className="underline" href={`mailto:${r.email}`}>{r.email}</a>{r.phone && ` · ${r.phone}`}
              {r.order_number && <> · Order <Link className="underline" href={`/admin/orders?q=${encodeURIComponent(r.order_number)}`}>{r.order_number}</Link></>}
            </p>
            <p className="whitespace-pre-line">{r.message}</p>
            <ActionForm action={updateSupportRequest} submitLabel="Update" variant="outline" className="flex items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <StatusBadge status={r.status} />
              <select name="status" defaultValue={r.status} className="input w-40" aria-label="Status">
                <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
              </select>
            </ActionForm>
          </li>
        ))}
        {!data?.length && <li className="card p-6 text-center text-sm text-muted">Nothing here.</li>}
      </ul>
    </div>
  );
}
