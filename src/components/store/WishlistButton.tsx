"use client";

import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { toggleWishlist } from "@/app/actions/engagement";

export function WishlistButton({ productId, initialSaved }: { productId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        aria-pressed={saved}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleWishlist(productId);
            if (r.ok) {
              setSaved(Boolean(r.data?.saved));
              setError(null);
            } else setError(r.error);
          })
        }
        className="btn-ghost px-0 text-sm"
      >
        <Heart size={18} className={saved ? "fill-danger text-danger" : ""} aria-hidden="true" />
        {saved ? "Saved to wishlist" : "Add to wishlist"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
