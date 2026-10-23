import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment not completed",
  on_hold: "On hold",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorised",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  cod_pending: "Cash on delivery",
  cod_collected: "COD collected",
};

export function statusTone(status: string): string {
  if (["delivered", "confirmed", "paid", "cod_collected", "captured", "processed", "approved"].includes(status)) return "bg-success/10 text-success";
  if (["cancelled", "payment_failed", "failed", "rejected", "rto"].includes(status)) return "bg-danger/10 text-danger";
  if (["on_hold", "pending_payment", "pending", "authorized", "open"].includes(status)) return "bg-saffron/15 text-saffron-600";
  return "bg-almond-100 text-walnut";
}

export const FULFILMENT_STEPS: OrderStatus[] = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
