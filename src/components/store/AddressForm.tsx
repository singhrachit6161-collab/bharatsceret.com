"use client";

import { useActionState, useEffect } from "react";
import { saveAddress, type AddressFormState } from "@/app/actions/account";
import type { Address } from "@/lib/types";
import { INDIAN_STATES } from "@/lib/validation";

export function AddressForm({
  address,
  onSaved,
  onCancel,
  submitLabel = "Save address",
}: {
  address?: Address;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<AddressFormState, FormData>(saveAddress, null);
  useEffect(() => {
    if (state?.ok && state.addressId) onSaved?.(state.addressId);
  }, [state, onSaved]);
  const e = state?.errors ?? {};
  const field = (name: keyof Address, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`addr-${name}`} className="label">
        {label}
      </label>
      <input
        id={`addr-${name}`}
        name={name}
        defaultValue={(address?.[name] as string | null | undefined) ?? ""}
        aria-invalid={Boolean(e[name])}
        className="input"
        {...props}
      />
      {e[name] && <p className="mt-1 text-xs text-danger">{e[name]}</p>}
    </div>
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {address && <input type="hidden" name="id" value={address.id} />}
      {field("full_name", "Full name", { autoComplete: "name", required: true })}
      {field("phone", "Mobile number", { autoComplete: "tel-national", inputMode: "tel", required: true })}
      <div className="sm:col-span-2">{field("line1", "Flat / house no., building, street", { autoComplete: "address-line1", required: true })}</div>
      <div className="sm:col-span-2">{field("line2", "Area, locality (optional)", { autoComplete: "address-line2" })}</div>
      {field("landmark", "Landmark (optional)")}
      {field("pincode", "PIN code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6, required: true })}
      {field("city", "City / town", { autoComplete: "address-level2", required: true })}
      <div>
        <label htmlFor="addr-state" className="label">
          State / UT
        </label>
        <select id="addr-state" name="state" defaultValue={address?.state ?? ""} required className="input" aria-invalid={Boolean(e.state)}>
          <option value="" disabled>
            Select state
          </option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {e.state && <p className="mt-1 text-xs text-danger">{e.state}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="is_default" defaultChecked={address?.is_default} className="h-4 w-4 accent-walnut" />
        Make this my default address
      </label>
      {state?.message && !state.ok && (
        <p className="text-sm text-danger sm:col-span-2" role="alert">
          {state.message}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
