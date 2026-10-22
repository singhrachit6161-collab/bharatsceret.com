"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext, audit, denied, formBool, formString, refreshStorefront, type AdminFormState } from "@/lib/admin";
import { ADMIN_ROLES } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";

const uuid = z.uuid();
const istToIso = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

// --- Coupons -------------------------------------------------------------------

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Code: 3–30 letters, numbers, - or _"),
  description: z.string().trim().max(200).transform((v) => v || null),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.string().trim(),
  max_discount: z.string().trim(),
  min_order: z.string().trim(),
  starts_at: z.string().trim(),
  ends_at: z.string().trim(),
  usage_limit: z.string().trim(),
  per_customer_limit: z.string().trim(),
  scope: z.enum(["all", "products", "categories"]),
});

const optInt = (v: string) => (v ? Number(v) : null);

export async function saveCoupon(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const parsed = couponSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const c = parsed.data;
    const value = c.discount_type === "percentage" ? Number(c.discount_value) : rupeesToPaise(c.discount_value);
    if (!value || value <= 0 || (c.discount_type === "percentage" && (!Number.isInteger(value) || value > 100))) {
      return { ok: false, message: "Enter a valid discount (percentage 1–100, or a rupee amount)." };
    }
    const maxDiscount = c.max_discount ? rupeesToPaise(c.max_discount) : null;
    const minOrder = c.min_order ? rupeesToPaise(c.min_order) : 0;
    if ((c.max_discount && !maxDiscount) || minOrder === null) return { ok: false, message: "Enter valid rupee amounts." };
    const usage = optInt(c.usage_limit);
    const perCustomer = optInt(c.per_customer_limit);
    if ((usage !== null && (!Number.isInteger(usage) || usage < 1)) || (perCustomer !== null && (!Number.isInteger(perCustomer) || perCustomer < 1))) {
      return { ok: false, message: "Usage limits must be whole numbers of at least 1." };
    }
    const starts = istToIso(c.starts_at);
    const ends = istToIso(c.ends_at);
    if (starts && ends && ends <= starts) return { ok: false, message: "End date must be after start date." };

    const row = {
      code: c.code,
      description: c.description,
      discount_type: c.discount_type,
      discount_value: value,
      max_discount_paise: maxDiscount,
      min_order_paise: minOrder,
      starts_at: starts,
      ends_at: ends,
      usage_limit: usage,
      per_customer_limit: perCustomer,
      scope: c.scope,
      is_active: formBool(fd, "is_active"),
    };
    const res = id ? await db.from("coupons").update(row).eq("id", id).select("id").single() : await db.from("coupons").insert(row).select("id").single();
    if (res.error) return { ok: false, message: res.error.code === "23505" ? "That code already exists." : "Could not save coupon." };
    const couponId = res.data.id as string;

    const productIds = fd.getAll("product_ids").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);
    const categoryIds = fd.getAll("category_ids").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);
    await db.from("coupon_products").delete().eq("coupon_id", couponId);
    await db.from("coupon_categories").delete().eq("coupon_id", couponId);
    if (c.scope === "products" && productIds.length) await db.from("coupon_products").insert(productIds.map((product_id) => ({ coupon_id: couponId, product_id })));
    if (c.scope === "categories" && categoryIds.length) await db.from("coupon_categories").insert(categoryIds.map((category_id) => ({ coupon_id: couponId, category_id })));

    await audit(db, user.id, id ? "coupon.update" : "coupon.create", "coupon", couponId, { code: c.code, active: row.is_active });
    revalidatePath("/admin/coupons");
    return { ok: true, message: "Coupon saved." };
  } catch (e) {
    return denied(e);
  }
}

// --- Reviews -------------------------------------------------------------------

export async function moderateReview(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext();
    const id = formString(fd, "id");
    const status = z.enum(["approved", "rejected", "pending"]).safeParse(formString(fd, "status"));
    if (!uuid.safeParse(id).success || !status.success) return { ok: false, message: "Invalid request." };
    const note = formString(fd, "note").slice(0, 300) || null;
    const { data, error } = await db.from("product_reviews").update({ status: status.data, moderation_note: note }).eq("id", id).select("product_id").single();
    if (error) return { ok: false, message: "Could not update review." };
    await audit(db, user.id, "review.moderate", "review", id, { status: status.data, note });
    refreshStorefront();
    revalidatePath("/admin/reviews");
    return { ok: true, message: `Review ${status.data}.`, id: data.product_id };
  } catch (e) {
    return denied(e);
  }
}

// --- Homepage banners & sections ------------------------------------------------

const bannerSchema = z.object({
  placement: z.enum(["hero", "category_tile", "promo"]),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).transform((v) => v || null),
  cta_label: z.string().trim().max(40).transform((v) => v || null),
  link_url: z.string().trim().regex(/^\/[A-Za-z0-9\-_/?=&.%]*$/, "Link must be a site path starting with /"),
  image_url: z.string().trim().regex(/^(https:\/\/|\/)/, "Image must be an https URL or a site path"),
  mobile_image_url: z.string().trim().transform((v) => v || null).refine((v) => v === null || /^(https:\/\/|\/)/.test(v), "Invalid mobile image"),
  alt: z.string().trim().max(200),
  theme: z.enum(["walnut", "saffron", "olive", "cream"]),
  sort_order: z.coerce.number().int().min(0).max(9999),
  starts_at: z.string().trim(),
  ends_at: z.string().trim(),
});

export async function saveBanner(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const parsed = bannerSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const row = { ...parsed.data, starts_at: istToIso(parsed.data.starts_at), ends_at: istToIso(parsed.data.ends_at), is_active: formBool(fd, "is_active") };
    const res = id ? await db.from("homepage_banners").update(row).eq("id", id) : await db.from("homepage_banners").insert(row);
    if (res.error) return { ok: false, message: "Could not save banner." };
    await audit(db, user.id, id ? "banner.update" : "banner.create", "banner", id || null, { title: row.title });
    refreshStorefront();
    revalidatePath("/admin/banners");
    return { ok: true, message: "Banner saved." };
  } catch (e) {
    return denied(e);
  }
}

export async function deleteBanner(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid banner." };
    await db.from("homepage_banners").delete().eq("id", id);
    await audit(db, user.id, "banner.delete", "banner", id);
    refreshStorefront();
    revalidatePath("/admin/banners");
    return { ok: true, message: "Banner deleted." };
  } catch (e) {
    return denied(e);
  }
}

export async function saveSection(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const key = z.enum(["category_tiles", "bestsellers", "most_viewed", "latest", "promo_banners", "featured", "brand_showcase", "regions"]).safeParse(formString(fd, "key"));
    const title = formString(fd, "title").slice(0, 80);
    const sort = Number(formString(fd, "sort_order"));
    const limit = Number(formString(fd, "item_limit"));
    if (!key.success || !title || !Number.isInteger(sort) || !Number.isInteger(limit) || limit < 1 || limit > 24) return { ok: false, message: "Invalid section settings." };
    const { error } = await db.from("homepage_sections").update({ title, sort_order: sort, item_limit: limit, is_visible: formBool(fd, "is_visible") }).eq("key", key.data);
    if (error) return { ok: false, message: "Could not save section." };
    await audit(db, user.id, "homepage.section", "homepage_section", key.data, { title, sort, limit });
    refreshStorefront();
    revalidatePath("/admin/banners");
    return { ok: true, message: "Section saved." };
  } catch (e) {
    return denied(e);
  }
}

// --- Content pages ----------------------------------------------------------------

export async function saveContentPage(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const slug = z.enum(["about", "shipping-policy", "returns-policy", "privacy-policy", "terms", "faq"]).safeParse(formString(fd, "slug"));
    const title = formString(fd, "title").slice(0, 120);
    const body = formString(fd, "body").slice(0, 50000);
    if (!slug.success || !title || body.length < 10) return { ok: false, message: "Title and content are required." };
    const { error } = await db.from("content_pages").upsert({ slug: slug.data, title, body, updated_by: user.id });
    if (error) return { ok: false, message: "Could not save page." };
    await audit(db, user.id, "content.update", "content_page", slug.data);
    refreshStorefront();
    return { ok: true, message: "Page saved." };
  } catch (e) {
    return denied(e);
  }
}

// --- Store settings --------------------------------------------------------------

const rupees = (v: string) => (v ? rupeesToPaise(v) : null);

const SETTINGS_PARSERS: Record<string, (fd: FormData) => { value?: unknown; error?: string }> = {
  announcement: (fd) => {
    const link = formString(fd, "link_url");
    if (link && !link.startsWith("/")) return { error: "Announcement link must start with /" };
    return { value: { enabled: formBool(fd, "enabled"), message: formString(fd, "message").slice(0, 160), link_label: formString(fd, "link_label").slice(0, 40), link_url: link } };
  },
  store_contact: (fd) => {
    const email = formString(fd, "email");
    if (email && !z.email().safeParse(email).success) return { error: "Invalid email" };
    const fssai = formString(fd, "fssai_license");
    if (fssai && !/^\d{14}$/.test(fssai)) return { error: "FSSAI licence number must be 14 digits" };
    const keys = ["brand_name", "legal_name", "phone", "whatsapp", "address", "hours"];
    return { value: { ...Object.fromEntries(keys.map((k) => [k, formString(fd, k).slice(0, 300)])), email, fssai_license: fssai } };
  },
  shipping: (fd) => {
    const flat = rupees(formString(fd, "flat_fee"));
    const free = formString(fd, "free_threshold") ? rupees(formString(fd, "free_threshold")) : null;
    const min = Number(formString(fd, "estimated_days_min"));
    const max = Number(formString(fd, "estimated_days_max"));
    const prefixes = formString(fd, "serviceable_pincode_prefixes").split(/[\s,]+/).filter(Boolean);
    if (flat === null || (formString(fd, "free_threshold") && free === null)) return { error: "Enter valid rupee amounts." };
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 60) return { error: "Invalid delivery window." };
    if (prefixes.some((p) => !/^[1-9]\d{0,5}$/.test(p))) return { error: "PIN prefixes must be 1–6 digits." };
    return { value: { flat_fee_paise: flat, free_shipping_threshold_paise: free, estimated_days_min: min, estimated_days_max: max, serviceable_pincode_prefixes: prefixes } };
  },
  cod: (fd) => {
    const fee = rupees(formString(fd, "fee")) ?? 0;
    const min = rupees(formString(fd, "min_order")) ?? 0;
    const max = rupees(formString(fd, "max_order"));
    if (max === null || max < min) return { error: "Enter a valid maximum COD order value." };
    return { value: { enabled: formBool(fd, "enabled"), fee_paise: fee, min_order_paise: min, max_order_paise: max } };
  },
  checkout: (fd) => {
    const minutes = Number(formString(fd, "reservation_minutes"));
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) return { error: "Reservation window must be 5–120 minutes." };
    return { value: { reservation_minutes: minutes } };
  },
  social: (fd) => {
    const out: Record<string, string> = {};
    for (const k of ["instagram", "facebook", "youtube", "x"]) {
      const v = formString(fd, k);
      if (v && !/^https:\/\//.test(v)) return { error: `${k} link must start with https://` };
      out[k] = v;
    }
    return { value: out };
  },
  heritage: (fd) => {
    const url = formString(fd, "cta_url");
    if (url && !url.startsWith("/")) return { error: "Link must be a site path starting with /" };
    const pillars = [0, 1, 2]
      .map((i) => ({ title: formString(fd, `pillar_title_${i}`).slice(0, 60), text: formString(fd, `pillar_text_${i}`).slice(0, 160) }))
      .filter((p) => p.title);
    return {
      value: {
        enabled: formBool(fd, "enabled"),
        eyebrow: formString(fd, "eyebrow").slice(0, 60),
        title: formString(fd, "title").slice(0, 120),
        body: formString(fd, "body").slice(0, 800),
        cta_label: formString(fd, "cta_label").slice(0, 40),
        cta_url: url,
        image_url: (() => {
          const img = formString(fd, "image_url");
          return /^(https:\/\/|\/)/.test(img) ? img : "/brand/heritage-peacock-box.webp";
        })(),
        pillars,
      },
    };
  },
  hamper: (fd) => {
    const min = Number(formString(fd, "min_items"));
    const max = Number(formString(fd, "message_max"));
    const slugs = fd.getAll("eligible_category_slugs").filter((v): v is string => typeof v === "string" && /^[a-z0-9-]{1,80}$/.test(v));
    if (!Number.isInteger(min) || min < 1 || min > 24) return { error: "Minimum items must be 1–24." };
    if (!Number.isInteger(max) || max < 0 || max > 200) return { error: "Message length must be 0–200 characters." };
    if (!slugs.length) return { error: "Choose at least one eligible collection." };
    return { value: { enabled: formBool(fd, "enabled"), min_items: min, message_max: max, eligible_category_slugs: slugs } };
  },
  trust_strip: (fd) => {
    const items = [0, 1, 2, 3]
      .map((i) => ({ icon: formString(fd, `icon_${i}`), title: formString(fd, `title_${i}`).slice(0, 60), text: formString(fd, `text_${i}`).slice(0, 120) }))
      .filter((it) => it.title);
    if (items.some((it) => !["truck", "package", "shield", "headset"].includes(it.icon))) return { error: "Invalid icon." };
    return { value: items };
  },
};

export async function saveSettings(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const key = formString(fd, "key");
    const parser = SETTINGS_PARSERS[key];
    if (!parser) return { ok: false, message: "Unknown setting." };
    const { value, error } = parser(fd);
    if (error) return { ok: false, message: error };
    const { error: dbError } = await db.from("store_settings").upsert({ key, value, updated_by: user.id });
    if (dbError) return { ok: false, message: "Could not save settings." };
    await audit(db, user.id, "settings.update", "store_settings", key, { value });
    refreshStorefront();
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return denied(e);
  }
}

// --- Support ---------------------------------------------------------------------

export async function updateSupportRequest(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext();
    const id = formString(fd, "id");
    const status = z.enum(["open", "in_progress", "resolved", "closed"]).safeParse(formString(fd, "status"));
    if (!uuid.safeParse(id).success || !status.success) return { ok: false, message: "Invalid request." };
    const { error } = await db.from("support_requests").update({ status: status.data }).eq("id", id);
    if (error) return { ok: false, message: "Could not update." };
    await audit(db, user.id, "support.status", "support_request", id, { status: status.data });
    revalidatePath("/admin/support");
    return { ok: true, message: "Updated." };
  } catch (e) {
    return denied(e);
  }
}
