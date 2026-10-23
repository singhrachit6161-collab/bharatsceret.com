"use client";

import { useActionState } from "react";
import { submitReview, type FormState } from "@/app/actions/engagement";

export function ReviewForm({ productId, defaultName }: { productId: string; defaultName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview, null);
  if (state?.ok) return <p className="rounded-md bg-almond-100 p-4 text-sm text-walnut" role="status">{state.message}</p>;
  return (
    <form action={action} className="card space-y-4 p-5">
      <h3 className="text-lg font-semibold text-walnut">Write a review</h3>
      <input type="hidden" name="product_id" value={productId} />
      <fieldset>
        <legend className="label">Rating</legend>
        <div className="flex gap-3">
          {[5, 4, 3, 2, 1].map((r) => (
            <label key={r} className="flex items-center gap-1 text-sm">
              <input type="radio" name="rating" value={r} required defaultChecked={r === 5} className="accent-walnut" /> {r}★
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="rv-name" className="label">Display name</label>
        <input id="rv-name" name="author_name" defaultValue={defaultName} maxLength={60} required className="input" />
        {state?.errors?.author_name && <p className="mt-1 text-xs text-danger">{state.errors.author_name}</p>}
      </div>
      <div>
        <label htmlFor="rv-title" className="label">Title (optional)</label>
        <input id="rv-title" name="title" maxLength={120} className="input" />
      </div>
      <div>
        <label htmlFor="rv-body" className="label">Your review</label>
        <textarea id="rv-body" name="body" rows={4} minLength={10} maxLength={2000} required className="input" />
        {state?.errors?.body && <p className="mt-1 text-xs text-danger">{state.errors.body}</p>}
      </div>
      {state?.message && <p className="text-sm text-danger" role="alert">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Submitting…" : "Submit review"}
      </button>
      <p className="text-xs text-muted">Reviews are moderated before they appear. Verified-purchase badges are added automatically for delivered orders.</p>
    </form>
  );
}
