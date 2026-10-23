"use client";

import { useActionState } from "react";
import { submitContact, type FormState } from "@/app/actions/engagement";

export function ContactForm({ orderNumber }: { orderNumber?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitContact, null);
  if (state?.ok) return <p className="rounded-md bg-success/10 p-4 text-sm text-success" role="status">{state.message}</p>;
  const e = state?.errors ?? {};
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${name}`} className="label">{label}</label>
      <input id={`c-${name}`} name={name} className="input" aria-invalid={Boolean(e[name])} {...props} />
      {e[name] && <p className="mt-1 text-xs text-danger">{e[name]}</p>}
    </div>
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {input("name", "Name", { required: true, autoComplete: "name" })}
      {input("email", "Email", { type: "email", required: true, autoComplete: "email" })}
      {input("phone", "Mobile (optional)", { inputMode: "tel", autoComplete: "tel-national" })}
      {input("order_number", "Order number (optional)", { defaultValue: orderNumber })}
      <div className="sm:col-span-2">{input("subject", "Subject", { required: true })}</div>
      <div className="sm:col-span-2">
        <label htmlFor="c-message" className="label">Message</label>
        <textarea id="c-message" name="message" rows={5} required minLength={10} maxLength={4000} className="input" />
        {e.message && <p className="mt-1 text-xs text-danger">{e.message}</p>}
      </div>
      {state?.message && <p className="text-sm text-danger sm:col-span-2" role="alert">{state.message}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send message"}</button>
      </div>
    </form>
  );
}
