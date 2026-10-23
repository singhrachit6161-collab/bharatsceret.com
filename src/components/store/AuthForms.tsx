"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "@/app/actions/auth";

function Field({ id, label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Message({ state }: { state: AuthState }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-md p-3 text-sm ${state.ok ? "bg-almond-100 text-walnut" : "bg-danger/10 text-danger"}`}>
      {state.message}
      {state.link && (
        <>
          {" "}
          <Link href={state.link.href} className="font-semibold underline underline-offset-2">
            {state.link.label}
          </Link>
        </>
      )}
    </p>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Message state={state} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={state?.errors?.email} />
      <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" required error={state?.errors?.password} />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-walnut underline-offset-2 hover:underline">
          Forgot password?
        </Link>
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Message state={state} />
      <Field id="full_name" name="full_name" label="Full name" autoComplete="name" required error={state?.errors?.full_name} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={state?.errors?.email} />
      <Field id="password" name="password" type="password" label="Password (min. 8 characters)" autoComplete="new-password" minLength={8} required error={state?.errors?.password} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-xs text-muted">
        By creating an account you agree to our <Link href="/policies/terms" className="underline">terms</Link> and{" "}
        <Link href="/policies/privacy-policy" className="underline">privacy policy</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={state?.errors?.email} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <Field id="password" name="password" type="password" label="New password" autoComplete="new-password" minLength={8} required error={state?.errors?.password} />
      <Field id="confirm" name="confirm" type="password" label="Confirm new password" autoComplete="new-password" required error={state?.errors?.confirm} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
