import { PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminNewsletter() {
  await requireStaffPage(ADMIN_ROLES);
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Newsletter"
        description={`${count ?? 0} subscribers. Exports contain personal data — store them securely and only use them for consented emails.`}
        actions={<a href="/admin/newsletter/export" className="btn-outline">Export CSV</a>}
      />
      <Table>
        <thead><tr><Th>Email</Th><Th>Status</Th><Th>Subscribed</Th></tr></thead>
        <tbody>
          {(data ?? []).map((s) => (
            <tr key={s.id}><Td>{s.email}</Td><Td>{s.status}</Td><Td>{new Date(s.created_at).toLocaleDateString("en-IN")}</Td></tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
