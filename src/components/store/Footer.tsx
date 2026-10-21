import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { getCategories } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { NewsletterForm } from "./NewsletterForm";

const INFO = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
  { href: "/policies/shipping-policy", label: "Shipping & delivery" },
  { href: "/policies/returns-policy", label: "Return, refund & cancellation" },
  { href: "/policies/privacy-policy", label: "Privacy policy" },
  { href: "/policies/terms", label: "Terms & conditions" },
  { href: "/faq", label: "FAQs" },
];
const ACCOUNT = [
  { href: "/account", label: "My account" },
  { href: "/account/orders", label: "Order history" },
  { href: "/track-order", label: "Track order" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
];

export async function Footer() {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const contact = settings.store_contact;
  const socials = Object.entries(settings.social).filter(([, url]) => typeof url === "string" && url.startsWith("https://"));
  const brand = contact.brand_name || "SwaadVana";

  return (
    <footer className="mt-auto bg-walnut text-ivory/90">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="font-display text-3xl font-bold text-ivory">
            Swaad<span className="text-saffron">Vana</span>
          </p>
          <p className="mt-3 max-w-sm text-sm text-ivory/70">
            Premium dry fruits, nuts, seeds and festive hampers — carefully packed and delivered across India.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {contact.email && (
              <li className="flex items-center gap-2">
                <Mail size={16} aria-hidden="true" /> <a href={`mailto:${contact.email}`} className="hover:text-saffron">{contact.email}</a>
              </li>
            )}
            {contact.phone && (
              <li className="flex items-center gap-2">
                <Phone size={16} aria-hidden="true" /> <a href={`tel:${contact.phone}`} className="hover:text-saffron">{contact.phone}</a>
              </li>
            )}
            {contact.address && (
              <li className="flex items-start gap-2">
                <MapPin size={16} aria-hidden="true" className="mt-0.5" /> <span>{contact.address}</span>
              </li>
            )}
            {contact.hours && <li className="text-ivory/60">Support hours: {contact.hours}</li>}
          </ul>
          <h2 className="mt-6 font-sans text-sm font-semibold tracking-wide text-ivory uppercase">Newsletter</h2>
          <p className="mt-1 text-xs text-ivory/60">Offers and new arrivals, a few times a month. Unsubscribe anytime.</p>
          <NewsletterForm />
        </div>
        <FooterList title="Information" links={INFO} />
        <FooterList title="My account" links={ACCOUNT} />
        <FooterList title="Top categories" links={categories.slice(0, 7).map((c) => ({ href: `/category/${c.slug}`, label: c.name }))} />
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-ivory/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {contact.legal_name || brand}. All rights reserved.
            {contact.fssai_license && <span className="ml-2">FSSAI Lic. No. {contact.fssai_license}</span>}
          </p>
          <p>Payments: UPI · Cards · Netbanking · Wallets (via Razorpay){settings.cod.enabled ? " · Cash on delivery" : ""}</p>
          {socials.length > 0 && (
            <ul className="flex gap-4">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-saffron">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="font-sans text-sm font-semibold tracking-wide text-ivory uppercase">
        <span className="border-b-2 border-saffron pb-1">{title}</span>
      </h2>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-ivory/75 hover:text-saffron">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
