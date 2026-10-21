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
          className="w-full min-w-0 rounded-l-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-ivory placeholder:text-ivory/50 focus:border-saffron focus:outline-none"
        />
        <button type="submit" disabled={pending} className="rounded-r-md bg-saffron px-4 text-sm font-semibold text-walnut hover:bg-saffron-600 disabled:opacity-60">
          {pending ? "…" : "Subscribe"}
        </button>
      </div>
      <p aria-live="polite" className={`mt-2 text-xs ${state?.ok ? "text-saffron" : "text-red-300"}`}>
        {state?.message ?? state?.errors?.email ?? ""}
      </p>
    </form>
  );
}
