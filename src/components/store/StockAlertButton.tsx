"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { subscribeStockAlert } from "@/app/actions/alerts";

export function StockAlertButton({ variantId, returnTo }: { variantId: string; returnTo: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || message?.ok}
        onClick={() =>
          start(async () => {
            const r = await subscribeStockAlert(variantId);
            if (r.ok) setMessage({ ok: true, text: r.message });
            else if (r.signIn) router.push(`/login?next=${encodeURIComponent(returnTo)}`);
            else setMessage({ ok: false, text: r.error });
          })
        }
        className="btn-outline inline-flex w-full items-center justify-center gap-2"
      >
        <Bell size={16} aria-hidden="true" /> {pending ? "Saving…" : message?.ok ? "You'll be notified" : "Notify me when available"}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
