import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceView } from "@/components/store/InvoiceView";
import { PrintButton } from "@/components/store/PrintButton";
import { requireUser } from "@/lib/auth";
import { ensureInvoice, getInvoice, invoiceReady } from "@/lib/data/invoices";
import { getOrderByNumber } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

export default async function CustomerInvoicePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const user = await requireUser("/account/orders");
  const order = await getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order || order.user_id !== user.id) notFound();

  let invoice = await getInvoice(order.id);
  let failed = false;
  if (!invoice && invoiceReady(order)) {
    const issued = await ensureInvoice(order.id, null);
    if ("invoice" in issued) invoice = issued.invoice;
    else failed = true;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/account/orders/${encodeURIComponent(order.order_number)}`} className="text-sm text-walnut underline">← Back to order</Link>
        {invoice && <PrintButton />}
      </div>
      {invoice ? (
        <InvoiceView invoice={invoice} />
      ) : (
        <p className="rounded-md bg-almond-100 p-4 text-sm">
          {failed
            ? "Your invoice is being prepared. Please check again shortly or contact us."
            : "Your invoice will be available once your order is packed for dispatch."}
        </p>
      )}
    </div>
  );
}
