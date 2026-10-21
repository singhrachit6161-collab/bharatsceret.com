import { z } from "zod";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
] as const;

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

/** Indian mobile: 10 digits starting 6-9; tolerates +91 / 0 prefixes and spaces. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code");

export const addressSchema = z.object({
  full_name: trimmed(2, 120, "Full name"),
  phone: phoneSchema,
  line1: trimmed(3, 200, "Address line 1"),
  line2: z.string().trim().max(200).optional().transform((v) => v || null),
  landmark: z.string().trim().max(120).optional().transform((v) => v || null),
  city: trimmed(2, 80, "City"),
  state: z.enum(INDIAN_STATES, { message: "Select a state" }),
  pincode: pincodeSchema,
  is_default: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  address_id: z.uuid("Select a delivery address"),
  payment_method: z.enum(["razorpay", "cod"]),
  coupon_code: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
  idempotency_key: z.string().regex(/^[A-Za-z0-9-]{8,100}$/, "Invalid request, please refresh"),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const reviewSchema = z.object({
  product_id: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().transform((v) => v || null),
  body: trimmed(10, 2000, "Review"),
  author_name: trimmed(1, 60, "Display name"),
});

export const contactSchema = z.object({
  name: trimmed(2, 120, "Name"),
  email: z.email("Enter a valid email").max(200),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(phoneSchema.optional()),
  order_number: z.string().trim().max(40).optional().transform((v) => v || null),
  subject: trimmed(3, 160, "Subject"),
  message: trimmed(10, 4000, "Message"),
});

export const newsletterSchema = z.object({ email: z.email("Enter a valid email").max(200) });

export const signUpSchema = z.object({
  full_name: trimmed(2, 120, "Full name"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const profileSchema = z.object({
  full_name: trimmed(2, 120, "Full name"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(phoneSchema.optional()),
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Flatten zod issues into a field → message map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
