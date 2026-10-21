"use client";

import { MapPin } from "lucide-react";
import { useState, useTransition } from "react";
import { checkPincode } from "@/app/actions/shipping";

export function PincodeChecker() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await checkPincode(pin);
          setResult("error" in r ? { ok: false, text: r.error } : { ok: r.serviceable, text: r.message });
        });
      }}
      className="rounded-md border border-line bg-white p-4"
    >
      <label htmlFor="pincode" className="label flex items-center gap-1.5">
        <MapPin size={16} aria-hidden="true" /> Check delivery
      </label>
      <div className="flex gap-2">
        <input id="pincode" inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" placeholder="Enter PIN code" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="input" />
        <button type="submit" disabled={pending || pin.length !== 6} className="btn-outline px-4 py-2">
          {pending ? "…" : "Check"}
        </button>
      </div>
      <p aria-live="polite" className={`mt-2 min-h-4 text-xs ${result?.ok ? "text-success" : "text-danger"}`}>
        {result?.text ?? ""}
      </p>
    </form>
  );
}
