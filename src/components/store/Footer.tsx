import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Ornament } from "@/components/ui/Ornament";
import { getCategories } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { NewsletterForm } from "./NewsletterForm";

const INFO = [
  { href: "/about", label: "Our story" },
  { href: "/contact", label: "Contact us" },
  { href: "/policies/shipping-policy", label: "Shipping & delivery" },
  { href: "/policies/returns-policy", label: "Returns, refunds & cancellation" },
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
  const brand = contact.brand_name || "Bharat Secrets";

  return (
    <footer className="bg-royal mt-auto text-ivory/85">
      <div className="border-b border-gold-light/15">
        <div className="container-page flex flex-col items-center gap-5 py-14 text-center">
          <p className="eyebrow text-gold-light">The Royal Circle</p>
          <h2 className="font-display text-3xl font-semibold text-ivory sm:text-4xl">Private offers & festive collections, first</h2>
          <Ornament tone="light" />
          <div className="w-full max-w-md">
            <NewsletterForm />
          </div>
          <p className="text-[11px] text-ivory/50">A few thoughtful emails a month. Unsubscribe anytime.</p>
        </div>
      </div>
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo size={150} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ivory/60">
            The royal treasury of Indian dry fruits — curated nuts, dates, berries and heirloom-style gift hampers.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {contact.email && (
              <li className="flex items-center gap-2.5"><Mail size={15} className="text-gold-light" aria-hidden="true" /> <a href={`mailto:${contact.email}`} className="hover:text-gold-light">{contact.email}</a></li>
            )}
            {contact.phone && (
              <li className="flex items-center gap-2.5"><Phone size={15} className="text-gold-light" aria-hidden="true" /> <a href={`tel:${contact.phone}`} className="hover:text-gold-light">{contact.phone}</a></li>
            )}
            {contact.address && (
              <li className="flex items-start gap-2.5"><MapPin size={15} className="mt-0.5 text-gold-light" aria-hidden="true" /> <span>{contact.address}</span></li>
            )}
            {contact.hours && <li className="text-ivory/50">Concierge hours: {contact.hours}</li>}
          </ul>
        </div>
        <FooterList title="The house" links={INFO} />
        <FooterList title="Your account" links={ACCOUNT} />
        <FooterList title="Collections" links={categories.slice(0, 7).map((c) => ({ href: `/category/${c.slug}`, label: c.name }))} />
      </div>
      <div className="border-t border-gold-light/15">
        <div className="container-page flex flex-col gap-3 py-6 text-[11px] tracking-wide text-ivory/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {contact.legal_name || brand}. Crafted in India.
            {contact.fssai_license && <span className="ml-2">FSSAI Lic. No. {contact.fssai_license}</span>}
          </p>
          <p>Secure payments by Razorpay · UPI · Cards · Netbanking{settings.cod.enabled ? " · Cash on delivery" : ""}</p>
          {socials.length > 0 && (
            <ul className="flex gap-4">
              {socials.map(([name, url]) => (
                <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-gold-light">{name}</a></li>
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
      <h2 className="font-display text-xl font-semibold text-gold-light">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-ivory/65 transition-colors hover:text-gold-light">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
