"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";

export function AddToCartButton({
  variantId,
  quantity = 1,
  disabled,
  compact = false,
  buyNow = false,
  label,
}: {
  variantId: string | null;
  quantity?: number;
  disabled?: boolean;
  compact?: boolean;
  buyNow?: boolean;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const onClick = () => {
    if (!variantId) return;
    setMessage(null);
    start(async () => {
      const res = await addToCart({ variantId, quantity });
      if (res.ok) {
        if (buyNow) {
          router.push("/checkout");
          return;
        }
        setMessage({ ok: true, text: "Added to cart" });
        setTimeout(() => setMessage(null), 2500);
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  };

  const isDisabled = disabled || !variantId || pending;
  const text = label ?? (buyNow ? "Buy now" : disabled ? "Out of stock" : "Add to cart");

  return (
    <div className={compact ? "w-full" : ""}>
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className={`${buyNow ? "btn-accent" : "btn-primary"} ${compact ? "w-full px-3 py-2 text-xs" : "w-full"}`}
      >
        {message?.ok ? <Check size={16} aria-hidden="true" /> : !buyNow && <ShoppingBag size={16} aria-hidden="true" />}
        {pending ? "Adding…" : message?.ok ? "Added" : text}
      </button>
      <p aria-live="polite" className={`mt-1 min-h-4 text-xs ${message?.ok ? "text-success" : "text-danger"}`}>
        {message && !message.ok ? message.text : ""}
      </p>
    </div>
  );
}
