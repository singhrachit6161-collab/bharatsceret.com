import { ChevronDown, Heart, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { getSessionUser } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { buildTree } from "@/lib/category-tree";
import { readCart } from "@/lib/data/cart";
import { getCategories } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { MobileMenu, type MenuGroup } from "./MobileMenu";
import { SearchBox } from "./SearchBox";

export async function Header() {
  const [user, cart, categories, settings] = await Promise.all([getSessionUser(), readCart(), getCategories(), getSettings()]);
  const count = cartCount(cart);
  // Main menu = top-level collections flagged for the menu; dropdown = their menu-flagged children.
  const collections = buildTree(categories)
    .filter((c) => c.show_in_nav)
    .map((c) => ({ ...c, children: c.children.filter((k) => k.show_in_nav) }));

  const mobileGroups: MenuGroup[] = [
    ...collections.map((c) => ({
      label: c.name,
      href: `/category/${c.slug}`,
      links: c.children.map((k) => ({ href: `/category/${k.slug}`, label: k.name })),
    })),
    {
      label: "More",
      links: [
        { href: "/shop", label: "All products" },
        { href: "/deals", label: "Offers" },
        { href: user ? "/account" : "/login", label: user ? "My account" : "Sign in" },
        { href: "/account/wishlist", label: "Wishlist" },
        { href: "/contact", label: "Contact us" },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-saffron/40 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      {settings.announcement.enabled && settings.announcement.message && (
        <div className="border-b border-saffron/50 bg-walnut px-4 py-2 text-center text-[11px] tracking-[0.2em] text-gold-light uppercase sm:text-xs">
          {settings.announcement.message}
          {settings.announcement.link_url && settings.announcement.link_label && (
            <Link href={settings.announcement.link_url} className="ml-3 font-semibold text-ivory underline decoration-saffron underline-offset-4 hover:text-gold-light">
              {settings.announcement.link_label}
            </Link>
          )}
        </div>
      )}

      <div className="container-page grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 lg:grid-cols-[1fr_auto_1fr] lg:py-3">
        <div className="flex items-center gap-2">
          <MobileMenu groups={mobileGroups} />
          <div className="hidden w-full max-w-sm lg:block">
            <SearchBox categories={[]} />
          </div>
        </div>
        <Link href="/" className="justify-self-center" aria-label="Bharat Secrets home">
          <Logo size={64} priority className="lg:hidden" />
          <Logo size={112} priority className="hidden lg:block" />
        </Link>
        <nav aria-label="Account" className="flex items-center justify-end gap-0.5 sm:gap-2">
          <Link href={user ? "/account" : "/login"} className="flex items-center gap-1.5 rounded-full p-2 text-walnut transition-colors hover:text-saffron-600">
            <User size={20} strokeWidth={1.6} aria-hidden="true" />
            <span className="hidden text-xs font-semibold tracking-[0.14em] uppercase xl:inline">{user ? "Account" : "Sign in"}</span>
            <span className="sr-only xl:hidden">{user ? "My account" : "Sign in"}</span>
          </Link>
          <Link href="/account/wishlist" className="hidden rounded-full p-2 text-walnut transition-colors hover:text-saffron-600 sm:block" aria-label="Wishlist">
            <Heart size={20} strokeWidth={1.6} />
          </Link>
          <Link href="/cart" className="relative flex items-center gap-2 rounded-full border border-walnut/15 px-3 py-2 text-walnut transition-colors hover:border-saffron hover:text-saffron-600">
            <ShoppingBag size={19} strokeWidth={1.6} aria-hidden="true" />
            <span className="hidden text-xs font-semibold tracking-[0.14em] uppercase sm:inline">Bag</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-walnut px-1 text-[11px] font-bold text-gold-light" aria-live="polite">
              <span className="sr-only">Cart, </span>
              {count}
              <span className="sr-only"> items</span>
            </span>
          </Link>
        </nav>
      </div>

      <div className="container-page pb-3 lg:hidden">
        <SearchBox categories={[]} />
      </div>

      <nav aria-label="Main" className="hidden border-t border-saffron/30 lg:block">
        <ul className="container-page flex items-center justify-center text-[12px] font-semibold tracking-[0.16em] text-walnut uppercase">
          {collections.map((c) => {
            const isGift = c.slug === "gifting";
            return (
              <li key={c.id} className="group relative">
                <Link
                  href={`/category/${c.slug}`}
                  className={`flex items-center gap-1 px-3 py-3.5 whitespace-nowrap transition-colors hover:text-saffron-600 xl:px-4 ${isGift ? "text-saffron-600" : ""}`}
                >
                  {isGift && <span aria-hidden="true">✦</span>}
                  {c.name}
                  {c.children.length > 0 && <ChevronDown size={13} aria-hidden="true" className="transition-transform group-hover:rotate-180" />}
                </Link>
                {c.children.length > 0 && (
                  <div className="invisible absolute top-full left-1/2 z-50 min-w-[300px] -translate-x-1/2 border border-saffron/40 bg-ivory opacity-0 shadow-2xl shadow-walnut/15 transition duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <div className="bg-royal px-6 py-4">
                      <p className="eyebrow text-gold-light">{c.slug === "regions" ? "Taste of the land" : "The collection"}</p>
                      <p className="mt-1 font-display text-2xl font-semibold tracking-normal text-ivory normal-case">{c.name}</p>
                    </div>
                    <ul className={`grid gap-x-6 px-6 py-4 font-display text-[17px] font-medium tracking-normal normal-case ${c.children.length > 5 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {c.children.map((k) => (
                        <li key={k.id}>
                          <Link href={`/category/${k.slug}`} className="block py-1.5 text-walnut transition-colors hover:translate-x-0.5 hover:text-saffron-600">
                            {k.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/category/${c.slug}`}
                      className="block border-t border-line px-6 py-3 text-[11px] font-semibold tracking-[0.22em] text-saffron-600 uppercase hover:bg-almond-100"
                    >
                      View all {c.name} →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
          <li>
            <Link href="/deals" className="block px-3 py-3.5 whitespace-nowrap transition-colors hover:text-saffron-600 xl:px-4">
              Offers
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
