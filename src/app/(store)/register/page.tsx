import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/store/AuthCard";
import { SignUpForm } from "@/components/store/AuthForms";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: n } = await searchParams;
  const next = n && n.startsWith("/") && !n.startsWith("//") ? n : "/account";
  if (await getSessionUser()) redirect(next);
  return (
    <AuthCard
      title="Create your account"
      subtitle="It only takes a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-walnut underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
