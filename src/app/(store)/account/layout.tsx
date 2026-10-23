import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getRoles, hasAnyRole, requireUser, STAFF_ROLES } from "@/lib/auth";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  const roles = await getRoles();
  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-xs text-muted">Signed in as</p>
        <p className="mb-4 truncate text-sm font-semibold text-walnut">{user.email}</p>
        <nav aria-label="Account">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-md px-3 py-2 text-sm whitespace-nowrap text-ink hover:bg-almond-100">
                  {l.label}
                </Link>
              </li>
            ))}
            {hasAnyRole(roles, STAFF_ROLES) && (
              <li>
                <Link href="/admin" className="block rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-saffron-600 hover:bg-almond-100">
                  Admin panel
                </Link>
              </li>
            )}
            <li>
              <form action={signOut}>
                <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm whitespace-nowrap text-muted hover:bg-almond-100">
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
