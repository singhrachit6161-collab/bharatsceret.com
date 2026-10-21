"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type FormState } from "@/app/actions/engagement";

export function NewsletterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeNewsletter, null);
  return (
    <form action={action} className="mt-3">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="Your email"
          className="w-full min-w-0 border border-gold-light/30 bg-white/5 px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 focus:border-gold-light focus:outline-none"
        />
        <button type="submit" disabled={pending} className="btn-accent rounded-none px-6 text-[11px] uppercase disabled:opacity-60">
          {pending ? "…" : "Join"}
        </button>
      </div>
      <p aria-live="polite" className={`mt-2 text-xs ${state?.ok ? "text-saffron" : "text-red-300"}`}>
        {state?.message ?? state?.errors?.email ?? ""}
      </p>
    </form>
  );
}
