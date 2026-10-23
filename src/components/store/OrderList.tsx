import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderSummary } from "@/lib/types";

export function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="card divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${encodeURIComponent(o.order_number)}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-almond-100/50">
            <span>
              <span className="block font-semibold text-walnut">{o.order_number}</span>
              <span className="text-xs text-muted">{new Date(o.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
            </span>
            <StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status]} />
            <span className="font-semibold">{formatINR(Number(o.total_paise))}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
