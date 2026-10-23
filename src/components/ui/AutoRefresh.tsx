"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ seconds, maxTimes = 24 }: { seconds: number; maxTimes?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > maxTimes) clearInterval(t);
      else router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, maxTimes]);
  return null;
}
