import type { Metadata } from "next";
import { AuthCard } from "@/components/store/AuthCard";
import { ResetPasswordForm } from "@/components/store/AuthForms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in via /auth/callback before landing here.
  await requireUser("/reset-password");
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
