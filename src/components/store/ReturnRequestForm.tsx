"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestReturn } from "@/app/actions/returns";
import { RETURN_REASONS, type ReturnReason } from "@/lib/returns";

interface Item {
  id: string;
  name: string;
  label: string;
  quantity: number;
}

export function ReturnRequestForm({ orderId, items, daysLeft, policyNote }: { orderId: string; items: Item[]; daysLeft: number; policyNote: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return <p className="rounded-md bg-success/10 p-4 text-sm text-success" role="status">Thank you. Your return request has been sent and our team will get back to you.</p>;
  }
  if (!open) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          Something wrong with your order? You can report it for <strong>{daysLeft} more day{daysLeft === 1 ? "" : "s"}</strong>.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="btn-outline">Report a problem / return</button>
      </div>
    );
  }

  const selected = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
  const submit = () => {
    setError(null);
    if (!reason) return setError("Please choose a reason.");
    start(async () => {
      const r = await requestReturn({ orderId, reason, details, items: selected });
      if (r.ok) {
        setDone(true);
        router.refresh();
      } else setError(r.error);
    });
  };

  return (
    <section className="card space-y-4 p-5" aria-labelledby="return-title">
      <h2 id="return-title" className="font-display text-2xl font-semibold text-walnut">Report a problem / request a return</h2>
      {policyNote && <p className="text-sm text-muted">{policyNote}</p>}
      <fieldset className="space-y-2">
        <legend className="label">Which items?</legend>
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3 text-sm">
            <span>
              {i.name} <span className="text-muted">· {i.label}</span>
            </span>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted">Qty</span>
              <select
                value={qty[i.id] ?? 0}
                onChange={(e) => setQty((q) => ({ ...q, [i.id]: Number(e.target.value) }))}
                className="input w-20 py-1"
                aria-label={`Quantity of ${i.name} to return`}
              >
                {Array.from({ length: i.quantity + 1 }, (_, n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </fieldset>
      <div>
        <label htmlFor="return-reason" className="label">Reason</label>
        <select id="return-reason" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)} className="input">
          <option value="">Choose a reason…</option>
          {Object.entries(RETURN_REASONS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="return-details" className="label">What happened?</label>
        <textarea id="return-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={1000} className="input" placeholder="Please describe the problem. If you can, keep photos ready — our team may ask for them." />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending || !selected.length || details.trim().length < 10} className="btn-primary">
          {pending ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
      </div>
    </section>
  );
}
