import type { Metadata } from "next";
import { ContactForm } from "@/components/store/ContactForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [{ order }, settings] = await Promise.all([searchParams, getSettings()]);
  const c = settings.store_contact;
  return (
    <div className="container-page pb-16">
      <Breadcrumbs items={[{ name: "Contact us" }]} />
      <h1 className="section-title mb-6">Contact us</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <ContactForm orderNumber={order?.slice(0, 40)} />
        </div>
        <aside className="card h-fit space-y-2 p-6 text-sm">
          <h2 className="text-lg font-semibold text-walnut">Customer support</h2>
          {c.email && <p>Email: <a className="underline" href={`mailto:${c.email}`}>{c.email}</a></p>}
          {c.phone && <p>Phone: <a className="underline" href={`tel:${c.phone}`}>{c.phone}</a></p>}
          {c.whatsapp && <p>WhatsApp: {c.whatsapp}</p>}
          {c.hours && <p className="text-muted">Hours: {c.hours}</p>}
          {c.address && <p className="text-muted">{c.address}</p>}
        </aside>
      </div>
    </div>
  );
}
