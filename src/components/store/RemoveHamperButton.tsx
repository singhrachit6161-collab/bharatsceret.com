"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { removeHamper } from "@/app/actions/cart";

export function RemoveHamperButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await removeHamper(id);
            if (!r.ok) setError(r.error);
          })
        }
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
      >
        <Trash2 size={14} aria-hidden="true" /> {pending ? "Removing…" : "Remove hamper"}
      </button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
