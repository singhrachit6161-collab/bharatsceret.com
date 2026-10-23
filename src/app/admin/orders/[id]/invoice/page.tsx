import { notFound } from "next/navigation";
import { AdminCrumbs } from "@/components/admin/ui";
import { InvoiceView } from "@/components/store/InvoiceView";
import { PrintButton } from "@/components/store/PrintButton";
import { requireStaffPage } from "@/lib/auth";
import { ensureInvoice } from "@/lib/data/invoices";
import { createClient } from "@/lib/supabase/server";

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireStaffPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id, order_number").eq("id", id).maybeSingle();
  if (!order) notFound();
  const result = await ensureInvoice(order.id, user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <AdminCrumbs items={[{ name: "Orders", href: "/admin/orders" }, { name: order.order_number, href: `/admin/orders/${order.id}` }, { name: "Invoice" }]} />
        {"invoice" in result && <PrintButton />}
      </div>
      {"invoice" in result ? (
        <InvoiceView invoice={result.invoice} />
      ) : (
        <p className="rounded-md bg-saffron/15 p-4 text-sm text-saffron-600">{result.error}</p>
      )}
    </div>
  );
}
