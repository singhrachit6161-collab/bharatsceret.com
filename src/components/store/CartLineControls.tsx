"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { updateCartLine } from "@/app/actions/cart";

export function CartLineControls({ variantId, quantity, max }: { variantId: string; quantity: number; max: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (q: number) =>
    start(async () => {
      const r = await updateCartLine({ variantId, quantity: q });
      setError(r.ok ? null : r.error);
    });
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-md border border-line bg-white" role="group" aria-label="Quantity">
          <button type="button" disabled={pending || quantity <= 1} onClick={() => set(quantity - 1)} aria-label="Decrease quantity" className="p-2 text-walnut disabled:opacity-40">
            <Minus size={14} />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button type="button" disabled={pending || quantity >= max} onClick={() => set(quantity + 1)} aria-label="Increase quantity" className="p-2 text-walnut disabled:opacity-40">
            <Plus size={14} />
          </button>
        </div>
        <button type="button" disabled={pending} onClick={() => set(0)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
          <Trash2 size={14} aria-hidden="true" /> Remove
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
