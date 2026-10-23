import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/store/AuthCard";
import { SignInForm } from "@/components/store/AuthForms";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

function safe(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safe(sp.next);
  if (await getSessionUser()) redirect(next);
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to track orders, save addresses and check out faster."
      footer={
        <>
          New here?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-walnut underline">
            Create an account
          </Link>
        </>
      }
    >
      {sp.error === "link" && <p className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">That link is invalid or has expired.</p>}
      <SignInForm next={next} />
    </AuthCard>
  );
}
