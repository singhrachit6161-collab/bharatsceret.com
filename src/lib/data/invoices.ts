import "server-only";
import { buildInvoice, InvoiceSetupError, type InvoiceDocument } from "@/lib/invoice";
import { isServiceRoleConfigured } from "@/lib/server-env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "./settings";

export const INVOICE_READY_STATUSES = ["packed", "shipped", "out_for_delivery", "delivered", "refunded", "partially_refunded"];

export type InvoiceRecord = InvoiceDocument & { id: string; order_id: string; invoice_number: string; fiscal_year: string; issued_at: string };

const INVOICE_SELECT =
  "id, order_id, invoice_number, document_type, fiscal_year, issued_at, seller, buyer, place_of_supply, intra_state, lines, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise";

export function invoiceReady(order: { status: string; payment_method: string; payment_status: string }): boolean {
  return (
    INVOICE_READY_STATUSES.includes(order.status) &&
    (order.payment_method === "cod" || ["paid", "refunded", "partially_refunded"].includes(order.payment_status))
  );
}

/** Read through RLS: customers only get invoices for their own orders. */
export async function getInvoice(orderId: string): Promise<InvoiceRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select(INVOICE_SELECT).eq("order_id", orderId).maybeSingle();
  return (data as InvoiceRecord | null) ?? null;
}

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  payment_method: "razorpay" | "cod";
  payment_status: string;
  discount_paise: number;
  shipping_paise: number;
  cod_fee_paise: number;
  total_paise: number;
  contact_email: string | null;
  shipping_address: InvoiceDocumentAddress;
  order_items: { product_name: string; variant_label: string; sku: string; quantity: number; line_total_paise: number; products: { hsn_code: string | null; gst_rate: number | null } | null }[];
};
type InvoiceDocumentAddress = Parameters<typeof buildInvoice>[0]["order"]["address"];

/**
 * Issue the invoice for an order if it does not exist yet (idempotent; the
 * database assigns the sequential number). Callers must already have checked
 * that the requester may see this order.
 */
export async function ensureInvoice(orderId: string, actorId: string | null): Promise<{ invoice: InvoiceRecord } | { error: string }> {
  if (!isServiceRoleConfigured()) return { error: "Invoices need the server key to be configured." };
  const db = createServiceClient();
  const existing = await db.from("invoices").select(INVOICE_SELECT).eq("order_id", orderId).maybeSingle();
  if (existing.data) return { invoice: existing.data as InvoiceRecord };

  const { data } = await db
    .from("orders")
    .select(
      "id, order_number, created_at, status, payment_method, payment_status, discount_paise, shipping_paise, cod_fee_paise, total_paise, contact_email, shipping_address, order_items (product_name, variant_label, sku, quantity, line_total_paise, products (hsn_code, gst_rate))",
    )
    .eq("id", orderId)
    .maybeSingle();
  const order = data as unknown as OrderRow | null;
  if (!order) return { error: "Order not found." };
  if (!invoiceReady(order)) return { error: "The invoice is issued once the order is packed for dispatch." };

  const settings = await getSettings();
  let doc: InvoiceDocument;
  try {
    doc = buildInvoice({
      business: settings.business,
      brandName: settings.store_contact.brand_name,
      order: {
        orderNumber: order.order_number,
        orderDate: order.created_at,
        paymentMethod: order.payment_method,
        discountPaise: Number(order.discount_paise),
        shippingPaise: Number(order.shipping_paise),
        codFeePaise: Number(order.cod_fee_paise),
        totalPaise: Number(order.total_paise),
        email: order.contact_email,
        address: order.shipping_address,
      },
      lines: order.order_items.map((i) => ({
        name: `${i.product_name} (${i.variant_label})`,
        sku: i.sku,
        hsn: i.products?.hsn_code ?? null,
        gstRate: i.products?.gst_rate === null || i.products?.gst_rate === undefined ? null : Number(i.products.gst_rate),
        quantity: i.quantity,
        grossPaise: Number(i.line_total_paise),
      })),
    });
  } catch (e) {
    if (e instanceof InvoiceSetupError) return { error: e.message };
    throw e;
  }

  const { error } = await db.rpc("issue_invoice", { p_order_id: orderId, p_document: doc, p_actor: actorId });
  if (error) {
    console.error(`[invoice] issue failed for ${order.order_number}: ${error.message}`);
    return { error: "The invoice could not be issued. Please try again." };
  }
  const issued = await db.from("invoices").select(INVOICE_SELECT).eq("order_id", orderId).single();
  return issued.data ? { invoice: issued.data as InvoiceRecord } : { error: "The invoice could not be loaded." };
}
