import { NextResponse } from "next/server";
import { audit } from "@/lib/admin";
import { ADMIN_ROLES, assertRole, AuthorizationError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** CSV export of subscribers (owner/admin only, audited). */
export async function GET() {
  try {
    const { user } = await assertRole(ADMIN_ROLES);
    const supabase = await createClient();
    const { data } = await supabase.from("newsletter_subscribers").select("email, status, created_at").eq("status", "subscribed").order("created_at");
    await audit(supabase, user.id, "newsletter.export", "newsletter", null, { rows: data?.length ?? 0 });
    // Neutralise spreadsheet formula injection.
    const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const csv = ["email,status,subscribed_at", ...(data ?? []).map((r) => [r.email, r.status, r.created_at].map((v) => cell(String(v))).join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
}
