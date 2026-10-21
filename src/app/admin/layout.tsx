import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { ADMIN_ROLES, hasAnyRole, requireStaffPage } from "@/lib/auth";
import { isRazorpayConfigured, isRazorpayLiveMode, isServiceRoleConfigured } from "@/lib/server-env";

// Always render per request: every admin page depends on the signed-in user's roles.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, roles } = await requireStaffPage();
  const isAdmin = hasAnyRole(roles, ADMIN_ROLES);
  return (
    <div className="flex min-h-screen flex-col bg-almond-100/40 lg:flex-row">
      <aside className="bg-walnut text-ivory lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/admin" className="font-display text-xl font-bold">
            Swaad<span className="text-saffron">Vana</span> <span className="text-xs font-normal text-ivory/60">admin</span>
          </Link>
        </div>
        <AdminNav isAdmin={isAdmin} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!isServiceRoleConfigured() && <span className="rounded bg-danger/10 px-2 py-1 font-semibold text-danger">Service key missing: checkout & webhooks disabled</span>}
            {!isRazorpayConfigured() && <span className="rounded bg-danger/10 px-2 py-1 font-semibold text-danger">Razorpay not configured</span>}
            {isRazorpayConfigured() && !isRazorpayLiveMode() && <span className="rounded bg-saffron/20 px-2 py-1 font-semibold text-saffron-600">Razorpay TEST mode</span>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">{user.email} · {roles.join(", ")}</span>
            <Link href="/" className="text-walnut underline-offset-2 hover:underline">View store</Link>
            <form action={signOut}>
              <button type="submit" className="text-muted hover:text-danger">Sign out</button>
            </form>
          </div>
        </header>
        <main id="main" className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
