"use client";

import { useEffect } from "react";

const RECENT_KEY = "sv_recently_viewed";

/** Records an anonymous, de-duplicated product view and remembers recently viewed slugs on this device only. */
export function ProductViewTracker({ productId, slug }: { productId: string; slug: string }) {
  useEffect(() => {
    const flag = `sv_viewed_${productId}`;
    try {
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        void fetch("/api/products/view", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId }),
          keepalive: true,
        });
      }
    } catch {
      /* storage unavailable */
    }
    try {
      const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      const next = [slug, ...list.filter((s) => s !== slug)].slice(0, 12);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [productId, slug]);
  return null;
}
