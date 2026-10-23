import { saveSettings } from "@/app/admin/actions/content";
import { ActionForm } from "@/components/admin/ActionForm";
import { Check, Field } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/ui";
import { ADMIN_ROLES, requireStaffPage } from "@/lib/auth";
import { getCategories } from "@/lib/data/catalog";
import { getSettings } from "@/lib/data/settings";
import { paiseToRupeesString } from "@/lib/money";
import { INDIAN_STATES } from "@/lib/validation";

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
  const [s, categories] = await Promise.all([getSettings(), getCategories()]);
  const roots = categories.filter((c) => !c.parent_id);
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
      <Section title="Build Your Own Hamper" settingKey="hamper" description="Boxes are products whose variant has a hamper capacity (Products → variant). Items come from the collections ticked here, including their sub-collections.">
        <Check label="Hamper builder is live" name="enabled" defaultChecked={s.hamper.enabled} />
        <Field label="Minimum items per hamper" name="min_items" type="number" min={1} max={24} defaultValue={String(s.hamper.min_items)} />
        <Field label="Gift message limit (characters)" name="message_max" type="number" min={0} max={200} defaultValue={String(s.hamper.message_max)} />
        <fieldset className="sm:col-span-2">
          <legend className="label">Eligible collections</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {roots.map((c) => (
              <Check key={c.id} label={c.name} name="eligible_category_slugs" value={c.slug} defaultChecked={s.hamper.eligible_category_slugs.includes(c.slug)} />
            ))}
          </div>
        </fieldset>
      </Section>
      <Section title="Business & GST" settingKey="business" description="Printed on invoices. If you are not GST-registered, leave it unticked and customers get a Bill of Supply without tax. Set each product's HSN code and GST rate before turning this on.">
        <Check label="GST registered (issue tax invoices)" name="gst_registered" defaultChecked={s.business.gst_registered} />
        <Field label="Registered business name" name="legal_name" defaultValue={s.business.legal_name} />
        <Field label="GSTIN" name="gstin" defaultValue={s.business.gstin} maxLength={15} placeholder="27ABCDE1234F1Z5" />
        <div>
          <label htmlFor="f-bstate" className="label">State of registration</label>
          <select id="f-bstate" name="state" defaultValue={s.business.state} className="input">
            <option value="">Choose…</option>
            {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <Field label="Invoice number prefix" name="invoice_prefix" defaultValue={s.business.invoice_prefix} maxLength={6} hint="e.g. BS → BS/2627/00001" />
        <div className="sm:col-span-2">
          <label htmlFor="f-baddr" className="label">Registered address</label>
          <textarea id="f-baddr" name="address" defaultValue={s.business.address} rows={3} className="input" />
        </div>
      </Section>
      <Section title="Returns" settingKey="returns" description="Customers can report a problem from their order page within this many days of delivery. You review every request.">
        <Check label="Accept return requests online" name="enabled" defaultChecked={s.returns.enabled} />
        <Field label="Return window (days after delivery)" name="window_days" type="number" min={1} max={60} defaultValue={String(s.returns.window_days)} />
        <div className="sm:col-span-2">
          <label htmlFor="f-rnote" className="label">Policy note shown to customers</label>
          <textarea id="f-rnote" name="policy_note" defaultValue={s.returns.policy_note} rows={3} maxLength={600} className="input" />
        </div>
      </Section>
      <Section title="Social links" settingKey="social">
        {(["instagram", "facebook", "youtube", "x"] as const).map((k) => <Field key={k} label={k} name={k} defaultValue={s.social[k]} placeholder="https://" />)}
      </Section>
      <Section title="Heritage section (homepage)" settingKey="heritage" description="Your brand story. Only state sourcing, export or quality facts you can substantiate.">
        <Check label="Show on homepage" name="enabled" defaultChecked={s.heritage.enabled} />
        <Field label="Eyebrow" name="eyebrow" defaultValue={s.heritage.eyebrow} />
        <Field label="Title" name="title" defaultValue={s.heritage.title} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <label htmlFor="f-hbody" className="label">Story</label>
          <textarea id="f-hbody" name="body" defaultValue={s.heritage.body} rows={4} className="input" />
        </div>
        <Field label="Button label" name="cta_label" defaultValue={s.heritage.cta_label} />
        <Field label="Button link" name="cta_url" defaultValue={s.heritage.cta_url} />
        <Field label="Image URL" name="image_url" defaultValue={s.heritage.image_url ?? "/brand/heritage-peacock-box.webp"} className="sm:col-span-2" hint="Site path (e.g. /brand/heritage-peacock-box.webp) or an https URL from Storage." />
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 rounded-md border border-line p-3">
            <input name={`pillar_title_${i}`} defaultValue={s.heritage.pillars[i]?.title ?? ""} placeholder="Pillar title (empty = hidden)" className="input" aria-label={`Pillar ${i + 1} title`} />
            <input name={`pillar_text_${i}`} defaultValue={s.heritage.pillars[i]?.text ?? ""} placeholder="Pillar text" className="input" aria-label={`Pillar ${i + 1} text`} />
          </div>
        ))}
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
