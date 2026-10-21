"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelMyOrder } from "@/app/actions/account";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline border-danger/40 text-danger hover:border-danger">
        Cancel order
      </button>
    );
  }
  return (
    <div className="card space-y-3 p-4">
      <label htmlFor="cancel-reason" className="label">Why are you cancelling?</label>
      <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="input" />
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || reason.trim().length < 3}
          onClick={() =>
            start(async () => {
              const r = await cancelMyOrder(orderId, reason);
              if (r.ok) router.refresh();
              else setError(r.error);
            })
          }
          className="btn-danger"
        >
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Keep order</button>
      </div>
    </div>
  );
}
