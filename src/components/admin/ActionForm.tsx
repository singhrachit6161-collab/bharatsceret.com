"use client";

import { useActionState, useEffect, useRef } from "react";
import type { AdminFormState } from "@/lib/admin";

type Action = (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;

/** Small wrapper for admin forms backed by a server action, with inline status. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "primary",
  className = "space-y-3",
  resetOnSuccess = false,
}: {
  action: Action;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "outline" | "accent";
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.message && (
        <p role={state.ok ? "status" : "alert"} className={`rounded-md p-2.5 text-sm ${state.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`btn-${variant} py-2`}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
