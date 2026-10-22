import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { adminCancelOrder, initiateRefund, markCodCollected, restockReturn, saveShipment, updateOrderStatus } from "@/app/admin/actions/orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminCrumbs, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { OrderDetailView } from "@/components/store/OrderDetailView";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ADMIN_ROLES, hasAnyRole, requireStaffPage } from "@/lib/auth";
import { ORDER_DETAIL_SELECT } from "@/lib/data/orders";
import { formatINR, paiseToRupeesString } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";
import type { OrderDetail, OrderStatus } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["processing", "packed"],
  processing: ["packed"],
  packed: ["shipped", "processing"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { roles } = await requireStaffPage();
  const isAdmin = hasAnyRole(roles, ADMIN_ROLES);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(`${ORDER_DETAIL_SELECT}, stock_restored_at, payments (id, provider_order_id, provider_payment_id, amount_paise, status, method, error_code, error_description, created_at), refunds (id, amount_paise, status, reason, provider_refund_id, failure_reason, created_at)`)
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as unknown as OrderDetail & {
    stock_restored_at: string | null;
    payments: { id: string; provider_order_id: string; provider_payment_id: string | null; amount_paise: number; status: string; method: string | null; error_code: string | null; error_description: string | null; created_at: string }[];
    refunds: { id: string; amount_paise: number; status: string; reason: string; provider_refund_id: string | null; failure_reason: string | null; created_at: string }[];
  };
  order.order_status_history.sort((a, b) => a.created_at.localeCompare(b.created_at));
  order.order_bundles?.sort((a, b) => a.position - b.position);

  const pendingRefunds = order.refunds.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount_paise), 0);
  const refundable = Number(order.total_paise) - Number(order.refunded_paise) - pendingRefunds;
  const canRefund = isAdmin && order.payment_method === "razorpay" && ["paid", "partially_refunded"].includes(order.payment_status) && refundable > 0;
  const cancellable = ["pending_payment", "confirmed", "processing", "packed", "on_hold"].includes(order.status);
  const nextStatuses = NEXT_STATUS[order.status] ?? [];
  const shipment = order.shipments[0];

  return (
    <div className="space-y-6">
      <div>
        <AdminCrumbs items={[{ name: "Orders", href: "/admin/orders" }, { name: order.order_number }]} />
        <PageHeader title={`Order ${order.order_number}`} description={`${order.contact_email ?? "no email"} · ${order.contact_phone}`} />
      </div>
      {order.status === "on_hold" && (
        <p className="rounded-md bg-saffron/15 p-3 text-sm text-saffron-600">
          This order is on hold: a payment was captured after the reservation expired or after cancellation. Review stock and either confirm it or refund the customer.
        </p>
      )}
      {order.status === "cancelled" && ["paid", "partially_refunded"].includes(order.payment_status) && (
        <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">Cancelled with a captured payment — a refund of {formatINR(refundable)} is due.</p>
      )}
      {order.customer_note && <p className="card p-3 text-sm"><strong>Customer note:</strong> {order.customer_note}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <OrderDetailView order={order} />

          <section>
            <h2 className="mb-2 font-semibold text-walnut">Payments</h2>
            <Table>
              <thead><tr><Th>Gateway order</Th><Th>Payment id</Th><Th>Method</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-mono text-xs">{p.provider_order_id}</Td>
                    <Td className="font-mono text-xs">{p.provider_payment_id ?? "—"}</Td>
                    <Td>{p.method ?? "—"}</Td>
                    <Td><StatusBadge status={p.status} />{p.error_description && <span className="block text-xs text-danger">{p.error_description}</span>}</Td>
                    <Td className="text-right">{formatINR(Number(p.amount_paise))}</Td>
                  </tr>
                ))}
                {!order.payments.length && <tr><Td className="text-muted">{order.payment_method === "cod" ? "Cash on delivery" : "No payment attempts yet."}</Td></tr>}
              </tbody>
            </Table>
          </section>

          {order.refunds.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold text-walnut">Refunds</h2>
              <Table>
                <thead><tr><Th>Date</Th><Th>Reason</Th><Th>Gateway id</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {order.refunds.map((r) => (
                    <tr key={r.id}>
                      <Td>{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</Td>
                      <Td>{r.reason}{r.failure_reason && <span className="block text-xs text-danger">{r.failure_reason}</span>}</Td>
                      <Td className="font-mono text-xs">{r.provider_refund_id ?? "—"}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td className="text-right">{formatINR(Number(r.amount_paise))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-semibold text-walnut">History</h2>
            <ol className="card divide-y divide-line text-sm">
              {order.order_status_history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}<strong>{ORDER_STATUS_LABELS[h.to_status]}</strong>
                    {h.note && <span className="block text-xs text-muted">{h.note}</span>}
                  </span>
                  <time className="text-xs text-muted">{new Date(h.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {nextStatuses.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-3 font-semibold text-walnut">Update fulfilment</h2>
              <ActionForm action={updateOrderStatus} submitLabel="Update status">
                <input type="hidden" name="order_id" value={order.id} />
                <select name="status" className="input" aria-label="New status">
                  {nextStatuses.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                </select>
                <input name="note" placeholder="Note (optional)" className="input" maxLength={300} />
              </ActionForm>
            </div>
          )}
          {order.status === "on_hold" && (
            <div className="card p-4">
              <h2 className="mb-2 font-semibold text-walnut">Release hold</h2>
              <p className="mb-3 text-xs text-muted">Only possible when stock was allocated to this order. Otherwise cancel and refund.</p>
              <ActionForm action={updateOrderStatus} submitLabel="Confirm order">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="status" value="confirmed" />
                <input name="note" placeholder="Note" className="input" />
              </ActionForm>
            </div>
          )}

          {["confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"].includes(order.status) && (
            <div className="card p-4">
              <h2 className="mb-3 font-semibold text-walnut">{shipment ? "Update shipment" : "Create shipment"}</h2>
              <ActionForm action={saveShipment} submitLabel="Save shipment">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="shipment_id" value={shipment?.id ?? ""} />
                <input name="carrier" defaultValue={shipment?.carrier ?? ""} placeholder="Carrier (e.g. Delhivery)" required className="input" />
                <input name="tracking_number" defaultValue={shipment?.tracking_number ?? ""} placeholder="Tracking number" className="input" />
                <input name="tracking_url" defaultValue={shipment?.tracking_url ?? ""} placeholder="https://tracking link" className="input" />
                <select name="status" defaultValue={shipment?.status ?? "packed"} className="input" aria-label="Shipment status">
                  {Object.entries(SHIPMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="location" placeholder="Location (optional)" className="input" />
                <input name="note" placeholder="Event note (optional)" className="input" />
                <p className="text-xs text-muted">Manual update — recorded with your name. Order status advances automatically when valid.</p>
              </ActionForm>
            </div>
          )}

          {isAdmin && order.payment_method === "cod" && order.payment_status === "cod_pending" && order.status === "delivered" && (
            <div className="card p-4">
              <h2 className="mb-3 font-semibold text-walnut">COD collection</h2>
              <ActionForm action={markCodCollected} submitLabel="Mark COD collected">
                <input type="hidden" name="order_id" value={order.id} />
                <input name="note" placeholder="Courier remittance reference" required className="input" />
              </ActionForm>
            </div>
          )}

          {canRefund && (
            <div className="card border-danger/30 p-4">
              <h2 className="mb-1 font-semibold text-walnut">Refund</h2>
              <p className="mb-3 text-xs text-muted">Refundable: {formatINR(refundable)}. Refunds go to the original payment method via Razorpay.</p>
              <ActionForm action={initiateRefund} submitLabel="Issue refund" variant="danger" pendingLabel="Contacting Razorpay…">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="idempotency_key" value={randomUUID()} />
                <label className="label" htmlFor="rf-amt">Amount (₹)</label>
                <input id="rf-amt" name="amount" defaultValue={paiseToRupeesString(refundable)} inputMode="decimal" required className="input" />
                <input name="reason" placeholder="Reason" required minLength={3} className="input" />
                <label className="label" htmlFor="rf-confirm">Type REFUND to confirm</label>
                <input id="rf-confirm" name="confirm" autoComplete="off" required className="input" />
              </ActionForm>
            </div>
          )}

          {["delivered", "refunded", "partially_refunded"].includes(order.status) && !order.stock_restored_at && (
            <div className="card p-4">
              <h2 className="mb-1 font-semibold text-walnut">Return restock</h2>
              <p className="mb-3 text-xs text-muted">Add the returned items back to sellable stock (once). Independent from refunds.</p>
              <ActionForm action={restockReturn} submitLabel="Restock returned items" variant="outline">
                <input type="hidden" name="order_id" value={order.id} />
                <input name="note" placeholder="Condition / reason" required minLength={3} className="input" />
              </ActionForm>
            </div>
          )}

          {cancellable && (
            <div className="card border-danger/30 p-4">
              <h2 className="mb-1 font-semibold text-danger">Cancel order</h2>
              <p className="mb-3 text-xs text-muted">Releases or restores stock. Captured payments must then be refunded separately.</p>
              <ActionForm action={adminCancelOrder} submitLabel="Cancel order" variant="danger">
                <input type="hidden" name="order_id" value={order.id} />
                <input name="reason" placeholder="Reason" required minLength={3} className="input" />
                <label className="label" htmlFor="cx-confirm">Type CANCEL to confirm</label>
                <input id="cx-confirm" name="confirm" autoComplete="off" required className="input" />
              </ActionForm>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
