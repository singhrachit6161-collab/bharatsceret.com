"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Price } from "@/components/ui/Price";
import type { Variant } from "@/lib/types";
import { AddToCartButton } from "./AddToCartButton";
import { StockAlertButton } from "./StockAlertButton";

export function ProductPurchasePanel({ variants, productSlug }: { variants: Variant[]; productSlug: string }) {
  const firstAvailable = variants.find((v) => v.available > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const selected = variants.find((v) => v.id === selectedId) ?? firstAvailable;
  if (!selected) return <p className="text-sm text-muted">This product is currently unavailable.</p>;

  const maxQty = Math.max(0, Math.min(selected.max_per_order, selected.available));
  const inStock = maxQty > 0;
  const quantity = Math.min(qty, Math.max(1, maxQty));

  return (
    <div className="space-y-5">
      <div>
        <Price price={selected.price_paise} compareAt={selected.compare_at_paise} size="lg" />
        <p className="mt-1 text-xs text-muted">Inclusive of all taxes · SKU {selected.sku}</p>
      </div>

      {variants.length > 0 && (
        <fieldset>
          <legend className="label">Pack size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = v.available <= 0;
              const active = v.id === selected.id;
              return (
                <label
                  key={v.id}
                  className={`cursor-pointer rounded-md border px-4 py-2 text-sm transition-colors ${
                    active ? "border-walnut bg-walnut text-ivory" : "border-line bg-white text-ink hover:border-walnut"
                  } ${out ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={active}
                    onChange={() => {
                      setSelectedId(v.id);
                      setQty(1);
                    }}
                    className="sr-only"
                  />
                  {v.label}
                  {out && <span className="ml-1 text-xs">(sold out)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div>
        <p className={`text-sm font-medium ${inStock ? (selected.available <= 5 ? "text-danger" : "text-success") : "text-danger"}`}>
          {inStock ? (selected.available <= 5 ? `Only ${selected.available} left in stock` : "In stock") : "Out of stock"}
        </p>
      </div>

      {inStock && (
        <div className="flex items-center gap-3">
          <span className="label mb-0" id="qty-label">
            Quantity
          </span>
          <div className="inline-flex items-center rounded-md border border-line bg-white" role="group" aria-labelledby="qty-label">
            <button type="button" onClick={() => setQty(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="p-2.5 text-walnut disabled:opacity-40">
              <Minus size={16} />
            </button>
            <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
              {quantity}
            </span>
            <button type="button" onClick={() => setQty(Math.min(maxQty, quantity + 1))} disabled={quantity >= maxQty} aria-label="Increase quantity" className="p-2.5 text-walnut disabled:opacity-40">
              <Plus size={16} />
            </button>
          </div>
          <span className="text-xs text-muted">Max {maxQty} per order</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <AddToCartButton variantId={selected.id} quantity={quantity} disabled={!inStock} />
        {inStock && <AddToCartButton variantId={selected.id} quantity={quantity} buyNow />}
      </div>
      {!inStock && <StockAlertButton key={selected.id} variantId={selected.id} returnTo={`/product/${productSlug}`} />}
    </div>
  );
}
