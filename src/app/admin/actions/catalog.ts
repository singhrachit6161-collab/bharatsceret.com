"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminContext, audit, denied, formBool, formString, refreshStorefront, type AdminFormState } from "@/lib/admin";
import { ADMIN_ROLES } from "@/lib/auth";
import { sniffImageType } from "@/lib/image-sniff";
import { rupeesToPaise } from "@/lib/money";
import { slugify, slugSchema } from "@/lib/validation";

const uuid = z.uuid();
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const productSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  slug: z.string().trim().max(80),
  brand: z.string().trim().min(1).max(80),
  short_description: opt(300),
  description: opt(10000),
  ingredients: opt(2000),
  storage_instructions: opt(1000),
  allergen_info: opt(1000),
  shelf_life: opt(200),
  country_of_origin: opt(80),
  manufacturer_info: opt(1000),
  fssai_license: z.string().trim().max(20).regex(/^(\d{14})?$/, "FSSAI licence number must be 14 digits").transform((v) => v || null),
  hsn_code: z.string().trim().regex(/^(\d{4,8})?$/, "HSN code must be 4 to 8 digits").transform((v) => v || null),
  gst_rate: z
    .union([z.literal(""), z.enum(["0", "0.25", "3", "5", "12", "18", "28", "40"])])
    .transform((v) => (v === "" ? null : Number(v))),
  status: z.enum(["draft", "active", "archived"]),
  published_at: z.string().trim().max(30),
  featured_rank: z.coerce.number().int().min(0).max(9999),
  bestseller_rank: z.coerce.number().int().min(0).max(9999),
  seo_title: opt(70),
  seo_description: opt(170),
  og_image_url: opt(500),
});

/**
 * Publication checklist: labelling information a food product must carry
 * before it can be listed. The values themselves must come from the business.
 */
async function publishProblems(db: Awaited<ReturnType<typeof adminContext>>["db"], productId: string | null, p: z.infer<typeof productSchema>) {
  const missing: string[] = [];
  if (!p.description) missing.push("description");
  if (!p.ingredients) missing.push("ingredients");
  if (!p.manufacturer_info) missing.push("manufacturer / packer details");
  if (!p.fssai_license) missing.push("FSSAI licence number");
  if (!p.country_of_origin) missing.push("country of origin");
  if (!productId) {
    missing.push("at least one active variant (save as draft first)", "at least one image");
    return missing;
  }
  const [{ count: variants }, { count: images }] = await Promise.all([
    db.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", productId).eq("is_active", true),
    db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId),
  ]);
  if (!variants) missing.push("at least one active variant");
  if (!images) missing.push("at least one image");
  return missing;
}

export async function saveProduct(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const parsed = productSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const p = parsed.data;
    const slug = slugSchema.safeParse(p.slug || slugify(p.name));
    if (!slug.success) return { ok: false, message: "Slug: use lowercase letters, numbers and hyphens." };
    if (p.og_image_url && !/^(https:\/\/|\/)/.test(p.og_image_url)) return { ok: false, message: "Social image must be an https URL or a site path." };

    if (p.status === "active") {
      const missing = await publishProblems(db, id || null, p);
      if (missing.length) return { ok: false, message: `Cannot publish yet. Missing: ${missing.join(", ")}.` };
    }

    const publishedAt = p.published_at ? new Date(`${p.published_at}:00+05:30`) : null;
    if (publishedAt && Number.isNaN(publishedAt.getTime())) return { ok: false, message: "Invalid publish date." };
    const row = {
      ...p,
      slug: slug.data,
      published_at: publishedAt ? publishedAt.toISOString() : p.status === "active" ? new Date().toISOString() : null,
      is_featured: formBool(fd, "is_featured"),
      is_bestseller: formBool(fd, "is_bestseller"),
    };
    const categoryIds = fd.getAll("category_ids").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);

    const res = id
      ? await db.from("products").update(row).eq("id", id).select("id").single()
      : await db.from("products").insert(row).select("id").single();
    if (res.error) return { ok: false, message: res.error.code === "23505" ? "That slug is already used by another product." : "Could not save product." };
    const productId = res.data.id as string;

    await db.from("product_categories").delete().eq("product_id", productId);
    if (categoryIds.length) {
      await db.from("product_categories").insert(categoryIds.map((category_id) => ({ product_id: productId, category_id })));
    }
    await audit(db, user.id, id ? "product.update" : "product.create", "product", productId, { status: p.status, slug: slug.data });
    refreshStorefront();
    if (!id) redirect(`/admin/products/${productId}?created=1`);
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Product saved.", id: productId };
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    return denied(e);
  }
}

const variantSchema = z.object({
  product_id: z.uuid(),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,40}$/, "SKU: capitals, numbers and hyphens"),
  label: z.string().trim().min(1).max(60),
  weight_grams: z.string().trim().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v > 0), "Weight must be a whole number of grams"),
  price: z.string().trim(),
  compare_at: z.string().trim(),
  max_per_order: z.coerce.number().int().min(1).max(100),
  sort_order: z.coerce.number().int().min(0).max(999),
  initial_stock: z.string().trim().optional(),
  hamper_capacity: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 24), "Hamper capacity must be 1–24 items (or empty)"),
});

export async function saveVariant(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const parsed = variantSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const v = parsed.data;
    const price = rupeesToPaise(v.price);
    const compareAt = v.compare_at ? rupeesToPaise(v.compare_at) : null;
    if (price === null) return { ok: false, message: "Enter a valid price in rupees." };
    if (v.compare_at && (compareAt === null || compareAt <= price)) return { ok: false, message: "Compare-at price must be higher than the price (or left empty)." };

    const row = {
      product_id: v.product_id,
      sku: v.sku,
      label: v.label,
      weight_grams: v.weight_grams,
      price_paise: price,
      compare_at_paise: compareAt,
      max_per_order: v.max_per_order,
      sort_order: v.sort_order,
      is_active: formBool(fd, "is_active"),
      hamper_capacity: v.hamper_capacity,
    };
    const res = id
      ? await db.from("product_variants").update(row).eq("id", id).eq("product_id", v.product_id).select("id").single()
      : await db.from("product_variants").insert(row).select("id").single();
    if (res.error) return { ok: false, message: res.error.code === "23505" ? "That SKU already exists." : "Could not save variant." };

    const initial = v.initial_stock ? Number(v.initial_stock) : 0;
    if (!id && Number.isInteger(initial) && initial > 0) {
      await db.rpc("adjust_inventory", { p_variant_id: res.data.id, p_delta: initial, p_note: "Initial stock" });
    }
    await audit(db, user.id, id ? "variant.update" : "variant.create", "variant", res.data.id, { sku: v.sku, price_paise: price });
    refreshStorefront();
    revalidatePath(`/admin/products/${v.product_id}`);
    return { ok: true, message: "Variant saved." };
  } catch (e) {
    return denied(e);
  }
}

export async function deleteVariant(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const productId = formString(fd, "product_id");
    if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid variant." };
    const { count } = await db.from("order_items").select("id", { count: "exact", head: true }).eq("variant_id", id);
    if (count) return { ok: false, message: "This variant has been ordered before. Deactivate it instead of deleting." };
    const { error } = await db.from("product_variants").delete().eq("id", id);
    if (error) return { ok: false, message: "Could not delete variant (it may have reservations)." };
    await audit(db, user.id, "variant.delete", "variant", id);
    refreshStorefront();
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Variant deleted." };
  } catch (e) {
    return denied(e);
  }
}

// --- Images -----------------------------------------------------------------

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadProductImage(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const productId = formString(fd, "product_id");
    const file = fd.get("file");
    const alt = formString(fd, "alt").slice(0, 200);
    if (!uuid.safeParse(productId).success) return { ok: false, message: "Invalid product." };
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image file." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "Image must be 5 MB or smaller." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) return { ok: false, message: "Only JPEG, PNG, WebP or AVIF images are allowed." };

    // Server-generated object name: never trust the uploaded filename.
    const path = `products/${productId}/${randomUUID()}.${type.ext}`;
    const up = await db.storage.from("product-images").upload(path, bytes, { contentType: type.mime, upsert: false, cacheControl: "31536000" });
    if (up.error) return { ok: false, message: "Upload failed. Check storage configuration and your permissions." };
    const { data: pub } = db.storage.from("product-images").getPublicUrl(path);

    const { count } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const { error } = await db.from("product_images").insert({ product_id: productId, storage_path: path, url: pub.publicUrl, alt, sort_order: count ?? 0 });
    if (error) {
      await db.storage.from("product-images").remove([path]);
      return { ok: false, message: "Could not save image." };
    }
    await audit(db, user.id, "image.upload", "product", productId, { path });
    refreshStorefront();
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Image uploaded." };
  } catch (e) {
    return denied(e);
  }
}

export async function updateImage(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const productId = formString(fd, "product_id");
    const op = formString(fd, "op");
    if (!uuid.safeParse(id).success || !uuid.safeParse(productId).success) return { ok: false, message: "Invalid image." };
    const { data: images } = await db.from("product_images").select("id, sort_order, storage_path").eq("product_id", productId).order("sort_order").order("created_at");
    const list = images ?? [];
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) return { ok: false, message: "Image not found." };

    if (op === "delete") {
      await db.from("product_images").delete().eq("id", id);
      if (list[idx].storage_path) await db.storage.from("product-images").remove([list[idx].storage_path]);
      await audit(db, user.id, "image.delete", "product", productId, { image_id: id });
    } else if (op === "up" || op === "down") {
      const swap = op === "up" ? idx - 1 : idx + 1;
      if (swap >= 0 && swap < list.length) {
        const reordered = [...list];
        [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
        await Promise.all(reordered.map((img, i) => db.from("product_images").update({ sort_order: i }).eq("id", img.id)));
      }
    } else if (op === "alt") {
      await db.from("product_images").update({ alt: formString(fd, "alt").slice(0, 200) }).eq("id", id);
    }
    refreshStorefront();
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Image updated." };
  } catch (e) {
    return denied(e);
  }
}

// --- Categories ---------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80),
  description: opt(1000),
  image_url: opt(500),
  sort_order: z.coerce.number().int().min(0).max(9999),
  seo_title: opt(70),
  seo_description: opt(170),
  parent_id: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

export async function saveCategory(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    const parsed = categorySchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const slug = slugSchema.safeParse(parsed.data.slug || slugify(parsed.data.name));
    if (!slug.success) return { ok: false, message: "Invalid slug." };
    if (parsed.data.image_url && !/^(https:\/\/|\/)/.test(parsed.data.image_url)) return { ok: false, message: "Image must be an https URL or a site path." };
    if (id && parsed.data.parent_id === id) return { ok: false, message: "A category cannot be its own parent." };
    const row = { ...parsed.data, slug: slug.data, is_visible: formBool(fd, "is_visible"), show_in_nav: formBool(fd, "show_in_nav") };
    const res = id ? await db.from("categories").update(row).eq("id", id) : await db.from("categories").insert(row);
    if (res.error) {
      if (res.error.message?.includes("CATEGORY_CYCLE")) return { ok: false, message: "A collection cannot be placed inside its own sub-collection." };
      return { ok: false, message: res.error.code === "23505" ? "Slug already in use." : "Could not save category." };
    }
    await audit(db, user.id, id ? "category.update" : "category.create", "category", id || slug.data);
    refreshStorefront();
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category saved." };
  } catch (e) {
    return denied(e);
  }
}

export async function deleteCategory(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  try {
    const { db, user } = await adminContext(ADMIN_ROLES);
    const id = formString(fd, "id");
    if (!uuid.safeParse(id).success) return { ok: false, message: "Invalid category." };
    const [{ count: used }, { count: children }] = await Promise.all([
      db.from("product_categories").select("product_id", { count: "exact", head: true }).eq("category_id", id),
      db.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id),
    ]);
    if (used) return { ok: false, message: `This category has ${used} product(s). Move them or hide the category instead.` };
    if (children) return { ok: false, message: "This category has sub-categories. Move them first." };
    const { error } = await db.from("categories").delete().eq("id", id);
    if (error) return { ok: false, message: "Could not delete category." };
    await audit(db, user.id, "category.delete", "category", id);
    refreshStorefront();
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category deleted." };
  } catch (e) {
    return denied(e);
  }
}
