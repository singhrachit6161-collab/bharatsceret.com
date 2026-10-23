"use client";

import { useActionState } from "react";
import { updateProfile, type AddressFormState } from "@/app/actions/account";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState<AddressFormState, FormData>(updateProfile, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="pf-name" className="label">Full name</label>
        <input id="pf-name" name="full_name" defaultValue={fullName} required className="input" />
        {state?.errors?.full_name && <p className="mt-1 text-xs text-danger">{state.errors.full_name}</p>}
      </div>
      <div>
        <label htmlFor="pf-phone" className="label">Mobile number</label>
        <input id="pf-phone" name="phone" defaultValue={phone} inputMode="tel" className="input" />
        {state?.errors?.phone && <p className="mt-1 text-xs text-danger">{state.errors.phone}</p>}
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save profile"}</button>
        {state?.message && <p className={`text-sm ${state.ok ? "text-success" : "text-danger"}`} aria-live="polite">{state.message}</p>}
      </div>
    </form>
  );
}
