import { ChevronDown, Heart, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { readCart } from "@/lib/data/cart";
import { getCategories } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";

const PRIMARY_NAV = [
  { slug: "almonds", label: "Almonds" },
  { slug: "cashews", label: "Cashews" },
  { slug: "walnuts", label: "Walnuts" },
  { slug: "pistachios", label: "Pistachios" },
  { slug: "raisins", label: "Raisins" },
  { slug: "dates", label: "Dates" },
  { slug: "seeds", label: "Seeds" },
  { slug: "trail-mix", label: "Trail Mix" },
  { slug: "gift-hampers", label: "Gift Hampers" },
];

export async function Header() {
  const [user, cart, categories, settings] = await Promise.all([getSessionUser(), readCart(), getCategories(), getSettings()]);
  const count = cartCount(cart);
  const known = new Set(categories.map((c) => c.slug));
  const nav = PRIMARY_NAV.filter((n) => known.has(n.slug));
  const mobileLinks = [
    { href: "/shop", label: "All products" },
    ...categories.map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    { href: "/deals", label: "Deals" },
    { href: user ? "/account" : "/login", label: user ? "My account" : "Sign in" },
    { href: "/account/wishlist", label: "Wishlist" },
    { href: "/contact", label: "Contact us" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-ivory/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      {settings.announcement.enabled && settings.announcement.message && (
        <div className="bg-walnut px-4 py-1.5 text-center text-xs text-ivory sm:text-sm">
          {settings.announcement.message}
          {settings.announcement.link_url && settings.announcement.link_label && (
            <Link href={settings.announcement.link_url} className="ml-2 font-semibold text-saffron underline-offset-2 hover:underline">
              {settings.announcement.link_label}
            </Link>
          )}
        </div>
      )}
      <div className="container-page flex items-center gap-3 py-3 sm:gap-6">
        <MobileMenu links={mobileLinks} />
        <Link href="/" className="flex shrink-0 flex-col leading-none" aria-label="SwaadVana home">
          <span className="font-display text-2xl font-bold tracking-tight text-walnut sm:text-3xl">
            Swaad<span className="text-saffron">Vana</span>
          </span>
          <span className="mt-0.5 hidden text-[10px] tracking-[0.3em] text-muted uppercase sm:block">Premium dry fruits</span>
        </Link>
        <div className="hidden flex-1 md:block">
          <SearchBox categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
        </div>
        <nav aria-label="Account" className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link href={user ? "/account" : "/login"} className="flex items-center gap-1.5 rounded-md p-2 text-walnut hover:bg-almond-100">
            <User size={22} aria-hidden="true" />
            <span className="hidden text-sm font-medium lg:inline">{user ? "Account" : "Sign in"}</span>
            <span className="sr-only lg:hidden">{user ? "My account" : "Sign in"}</span>
          </Link>
          <Link href="/account/wishlist" className="hidden rounded-md p-2 text-walnut hover:bg-almond-100 sm:block" aria-label="Wishlist">
            <Heart size={22} />
          </Link>
          <Link href="/cart" className="relative flex items-center gap-1.5 rounded-md bg-walnut px-3 py-2 text-ivory hover:bg-walnut-700">
            <ShoppingBag size={20} aria-hidden="true" />
            <span className="text-sm font-semibold" aria-live="polite">
              <span className="sr-only">Cart, </span>
              {count}
              <span className="sr-only"> items</span>
            </span>
          </Link>
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBox categories={[]} />
      </div>
      <nav aria-label="Main" className="hidden bg-walnut lg:block">
        <ul className="container-page flex items-center gap-1 text-sm font-medium text-ivory">
          <li className="group relative">
            <Link href="/shop" className="flex items-center gap-1 bg-saffron px-4 py-3 font-semibold text-walnut hover:bg-saffron-600 hover:text-ivory">
              Shop by categories <ChevronDown size={16} aria-hidden="true" />
            </Link>
            <ul className="invisible absolute top-full left-0 z-50 w-60 rounded-b-md border border-line bg-white py-2 text-ink opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="block px-4 py-2 hover:bg-almond-100">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          {nav.map((n) => (
            <li key={n.slug}>
              <Link href={`/category/${n.slug}`} className="block px-3 py-3 hover:bg-walnut-700 hover:text-saffron">
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/deals" className="block px-3 py-3 hover:bg-walnut-700 hover:text-saffron">
              Deals
            </Link>
          </li>
          <li className="ml-auto">
            <Link href="/shop" className="block px-3 py-3 hover:bg-walnut-700 hover:text-saffron">
              All products
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
