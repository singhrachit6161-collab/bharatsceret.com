import { statusTone } from "@/lib/order-status";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
