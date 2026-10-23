"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation";

export type AuthState = { ok: boolean; message?: string; errors?: Record<string, string>; link?: { href: string; label: string } } | null;

/** Only allow same-site relative redirects. */
function safeNext(next: FormDataEntryValue | null): string {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/account";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const ip = await clientIp();
  if (!rateLimit(`signin:${ip}`, 10, 5 * 60_000) || !rateLimit(`signin:${parsed.data.email}`, 10, 15 * 60_000)) {
    return { ok: false, message: "Too many sign-in attempts. Please wait a few minutes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "Incorrect email or password, or email not yet confirmed." };
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000)) {
    return { ok: false, message: "Too many sign-up attempts. Please try again later." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Only the display name goes into metadata. Roles are never read from metadata.
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/account`,
    },
  });
  if (error?.code === "user_already_exists") {
    const next = safeNext(formData.get("next"));
    return {
      ok: false,
      message: "An account with this email already exists. Please sign in instead.",
      link: { href: `/login${next === "/account" ? "" : `?next=${encodeURIComponent(next)}`}`, label: "Sign in" },
    };
  }
  if (error) return { ok: false, message: error.message.includes("Password") ? error.message : "Could not create your account." };
  if (data.session) redirect(safeNext(formData.get("next")));
  return { ok: true, message: "Check your email to confirm your account, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, errors: { email: "Enter a valid email" } };
  if (!rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000)) return { ok: false, message: "Please try again later." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const pw = z.string().min(8, "Use at least 8 characters").max(72).safeParse(formData.get("password"));
  if (!pw.success) return { ok: false, errors: { password: pw.error.issues[0].message } };
  if (formData.get("password") !== formData.get("confirm")) return { ok: false, errors: { confirm: "Passwords do not match" } };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { ok: false, message: "Your reset link has expired. Please request a new one." };
  redirect("/account?password=updated");
}
