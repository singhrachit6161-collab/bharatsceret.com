import { RETURN_REASONS, RETURN_STATUS_LABELS, type ReturnRequest } from "@/lib/returns";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function ReturnRequestsList({
  requests,
  items,
  actions,
}: {
  requests: ReturnRequest[];
  items: { id: string; product_name: string; variant_label: string }[];
  /** Optional per-request controls (admin). */
  actions?: (r: ReturnRequest) => React.ReactNode;
}) {
  if (!requests.length) return null;
  const names = new Map(items.map((i) => [i.id, `${i.product_name} (${i.variant_label})`]));
  return (
    <section className="card space-y-4 p-5" aria-labelledby="returns-title">
      <h2 id="returns-title" className="font-display text-2xl font-semibold text-walnut">Return requests</h2>
      {[...requests]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => (
          <div key={r.id} className="space-y-2 border-t border-line pt-4 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{RETURN_REASONS[r.reason] ?? r.reason}</p>
              <span className="rounded-full bg-almond-100 px-3 py-0.5 text-xs font-semibold text-walnut">{RETURN_STATUS_LABELS[r.status] ?? r.status}</span>
            </div>
            <p className="text-xs text-muted">Requested {date(r.created_at)}{r.decided_at ? ` · updated ${date(r.decided_at)}` : ""}</p>
            <ul className="list-inside list-disc text-sm">
              {r.items.map((i) => (
                <li key={i.order_item_id}>{i.quantity} × {names.get(i.order_item_id) ?? "Item"}</li>
              ))}
            </ul>
            <p className="text-sm whitespace-pre-line">{r.details}</p>
            {r.resolution_note && <p className="rounded-md bg-almond-100 p-3 text-sm"><span className="font-semibold">Our response:</span> {r.resolution_note}</p>}
            {actions?.(r)}
          </div>
        ))}
    </section>
  );
}
