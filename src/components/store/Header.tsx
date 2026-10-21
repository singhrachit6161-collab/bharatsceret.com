import { ChevronDown, Heart, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
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
];

export async function Header() {
  const [user, cart, categories, settings] = await Promise.all([getSessionUser(), readCart(), getCategories(), getSettings()]);
  const count = cartCount(cart);
  const known = new Set(categories.map((c) => c.slug));
  const nav = PRIMARY_NAV.filter((n) => known.has(n.slug));
  const mobileLinks = [
    { href: "/shop", label: "All products" },
    ...categories.map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    { href: "/deals", label: "Offers" },
    { href: user ? "/account" : "/login", label: user ? "My account" : "Sign in" },
    { href: "/account/wishlist", label: "Wishlist" },
    { href: "/contact", label: "Contact us" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      {settings.announcement.enabled && settings.announcement.message && (
        <div className="bg-walnut px-4 py-2 text-center text-[11px] tracking-[0.2em] text-gold-light uppercase sm:text-xs">
          {settings.announcement.message}
          {settings.announcement.link_url && settings.announcement.link_label && (
            <Link href={settings.announcement.link_url} className="ml-3 font-semibold text-ivory underline decoration-saffron underline-offset-4 hover:text-gold-light">
              {settings.announcement.link_label}
            </Link>
          )}
        </div>
      )}

      <div className="container-page grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5 lg:grid-cols-[1fr_auto_1fr] lg:py-5">
        <div className="flex items-center gap-2">
          <MobileMenu links={mobileLinks} />
          <div className="hidden w-full max-w-sm lg:block">
            <SearchBox categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
          </div>
        </div>
        <Link href="/" className="justify-self-center" aria-label="Bharat Secret home">
          <Logo />
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

      <nav aria-label="Main" className="hidden border-t border-line/70 lg:block">
        <ul className="container-page flex items-center justify-center gap-1 text-[12px] font-semibold tracking-[0.18em] text-walnut uppercase">
          <li className="group relative">
            <Link href="/shop" className="flex items-center gap-1 px-4 py-3.5 transition-colors hover:text-saffron-600">
              Shop all <ChevronDown size={14} aria-hidden="true" />
            </Link>
            <div className="invisible absolute top-full left-1/2 z-50 w-[560px] -translate-x-1/2 border border-line bg-ivory p-6 opacity-0 shadow-2xl shadow-walnut/10 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <p className="eyebrow mb-4">The collection</p>
              <ul className="grid grid-cols-2 gap-x-8 gap-y-1 font-display text-lg font-medium tracking-normal normal-case">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/category/${c.slug}`} className="block py-1 text-walnut transition-colors hover:text-saffron-600">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
          {nav.map((n) => (
            <li key={n.slug}>
              <Link href={`/category/${n.slug}`} className="relative block px-3.5 py-3.5 transition-colors after:absolute after:inset-x-3.5 after:bottom-2 after:h-px after:origin-left after:scale-x-0 after:bg-saffron after:transition-transform hover:text-saffron-600 hover:after:scale-x-100">
                {n.label}
              </Link>
            </li>
          ))}
          {known.has("gift-hampers") && (
            <li>
              <Link href="/category/gift-hampers" className="block px-3.5 py-3.5 text-saffron-600 transition-colors hover:text-walnut">
                ✦ Gifting
              </Link>
            </li>
          )}
          <li>
            <Link href="/deals" className="block px-3.5 py-3.5 transition-colors hover:text-saffron-600">
              Offers
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
