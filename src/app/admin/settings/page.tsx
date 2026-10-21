import { saveSettings } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { Check, Field } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { paiseToRupeesString } from "@/lib/money";

function Section({ title, description, settingKey, children }: { title: string; description?: string; settingKey: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-walnut">{title}</h2>
      {description && <p className="mb-3 text-xs text-muted">{description}</p>}
      <ActionForm action={saveSettings} submitLabel="Save">
        <input type="hidden" name="key" value={settingKey} />
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      </ActionForm>
    </section>
  );
}

export default async function AdminSettings() {
  await requireStaffPage(ADMIN_ROLES);
  const s = await getSettings();
  const r = (p: number | null) => (p === null ? "" : paiseToRupeesString(p));
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Store settings" />
      <Section title="Announcement bar" settingKey="announcement">
        <Field label="Message" name="message" defaultValue={s.announcement.message} maxLength={160} className="sm:col-span-2" />
        <Field label="Link label" name="link_label" defaultValue={s.announcement.link_label} />
        <Field label="Link (site path)" name="link_url" defaultValue={s.announcement.link_url} />
        <Check label="Show announcement" name="enabled" defaultChecked={s.announcement.enabled} />
      </Section>
      <Section title="Store & contact details" settingKey="store_contact" description="Shown in the footer and contact page. Leave blank anything you do not want to publish.">
        <Field label="Brand name" name="brand_name" defaultValue={s.store_contact.brand_name} />
        <Field label="Legal business name" name="legal_name" defaultValue={s.store_contact.legal_name} />
        <Field label="Support email" name="email" type="email" defaultValue={s.store_contact.email} />
        <Field label="Support phone" name="phone" defaultValue={s.store_contact.phone} />
        <Field label="WhatsApp" name="whatsapp" defaultValue={s.store_contact.whatsapp} />
        <Field label="Support hours" name="hours" defaultValue={s.store_contact.hours} />
        <Field label="Registered address" name="address" defaultValue={s.store_contact.address} className="sm:col-span-2" />
        <Field label="FSSAI licence no." name="fssai_license" defaultValue={s.store_contact.fssai_license} maxLength={14} />
      </Section>
      <Section title="Shipping" settingKey="shipping" description="Used for checkout totals and the delivery checker. Estimates should match your courier's real performance.">
        <Field label="Flat shipping fee (₹)" name="flat_fee" defaultValue={r(s.shipping.flat_fee_paise)} required />
        <Field label="Free shipping above (₹)" name="free_threshold" defaultValue={r(s.shipping.free_shipping_threshold_paise)} hint="Leave empty for no free shipping" />
        <Field label="Delivery estimate: min days" name="estimated_days_min" type="number" min={1} defaultValue={String(s.shipping.estimated_days_min)} />
        <Field label="Delivery estimate: max days" name="estimated_days_max" type="number" min={1} defaultValue={String(s.shipping.estimated_days_max)} />
        <Field label="Serviceable PIN prefixes" name="serviceable_pincode_prefixes" defaultValue={s.shipping.serviceable_pincode_prefixes.join(", ")} hint="Comma-separated, e.g. 11, 40, 560. Empty = all PIN codes." className="sm:col-span-2" />
      </Section>
      <Section title="Cash on delivery" settingKey="cod">
        <Check label="Offer cash on delivery" name="enabled" defaultChecked={s.cod.enabled} />
        <Field label="COD fee (₹)" name="fee" defaultValue={r(s.cod.fee_paise)} />
        <Field label="Minimum order for COD (₹)" name="min_order" defaultValue={r(s.cod.min_order_paise)} />
        <Field label="Maximum order for COD (₹)" name="max_order" defaultValue={r(s.cod.max_order_paise)} />
      </Section>
      <Section title="Checkout" settingKey="checkout">
        <Field label="Stock reservation window (minutes)" name="reservation_minutes" type="number" min={5} max={120} defaultValue={String(s.checkout.reservation_minutes)} hint="How long unpaid online orders hold stock." />
      </Section>
      <Section title="Social links" settingKey="social">
        {(["instagram", "facebook", "youtube", "x"] as const).map((k) => <Field key={k} label={k} name={k} defaultValue={s.social[k]} placeholder="https://" />)}
      </Section>
      <Section title="Trust strip" settingKey="trust_strip" description="Only make claims you can substantiate.">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid gap-2 rounded-md border border-line p-3">
            <select name={`icon_${i}`} defaultValue={s.trust_strip[i]?.icon ?? "package"} className="input" aria-label={`Icon ${i + 1}`}>
              <option value="truck">Truck</option><option value="package">Package</option><option value="shield">Shield</option><option value="headset">Headset</option>
            </select>
            <input name={`title_${i}`} defaultValue={s.trust_strip[i]?.title ?? ""} placeholder="Title (empty = hidden)" className="input" aria-label={`Title ${i + 1}`} />
            <input name={`text_${i}`} defaultValue={s.trust_strip[i]?.text ?? ""} placeholder="Text" className="input" aria-label={`Text ${i + 1}`} />
          </div>
        ))}
      </Section>
    </div>
  );
}
