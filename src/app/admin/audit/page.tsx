import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const PAGE = 50;

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  await requireStaffPage(ADMIN_ROLES);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, details, created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.action && /^[a-z_.]+$/.test(sp.action)) q = q.eq("action", sp.action);
  const { data, count } = await q;
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  return (
    <div>
      <PageHeader title="Audit log" description="Sensitive administrative and system actions." />
      <Table>
        <thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr></thead>
        <tbody>
          {(data ?? []).map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</Td>
              <Td>{r.actor_id ? names.get(r.actor_id) || r.actor_id.slice(0, 8) : "system"}</Td>
              <Td className="font-mono text-xs">{r.action}</Td>
              <Td className="text-xs">{r.entity_type} {r.entity_id?.slice(0, 13)}</Td>
              <Td className="max-w-md font-mono text-xs"><span className="block truncate" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</span></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} hrefFor={(p) => `/admin/audit?page=${p}`} />
    </div>
  );
}
