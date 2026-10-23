/** Shared return-request rules and labels (customer UI, admin UI, server actions). */
export const RETURN_REASONS = {
  damaged: "Arrived damaged or leaking",
  wrong_item: "Wrong item received",
  missing_item: "Item missing from the package",
  quality: "Not fit for consumption / quality issue",
  other: "Something else",
} as const;
export type ReturnReason = keyof typeof RETURN_REASONS;

export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Not approved",
  received: "Item received",
  refunded: "Refunded",
  closed: "Closed",
};

export const OPEN_RETURN_STATUSES = ["requested", "approved", "received"];

export interface ReturnRequest {
  id: string;
  reason: ReturnReason;
  details: string;
  items: { order_item_id: string; quantity: number }[];
  status: string;
  resolution_note: string | null;
  created_at: string;
  decided_at: string | null;
}

/** Days left to request a return, or null when the order is not eligible. Mirrors request_return(). */
export function returnDaysLeft(
  order: { status: string; delivered_at: string | null },
  windowDays: number,
  now: Date = new Date(),
): number | null {
  if (!order.delivered_at || !["delivered", "partially_refunded"].includes(order.status)) return null;
  const deadline = new Date(order.delivered_at).getTime() + windowDays * 86_400_000;
  const left = Math.ceil((deadline - now.getTime()) / 86_400_000);
  return left > 0 ? left : null;
}
