import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/store/AuthCard";
import { ForgotPasswordForm } from "@/components/store/AuthForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure link to choose a new password." footer={<Link href="/login" className="text-walnut underline">Back to sign in</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
