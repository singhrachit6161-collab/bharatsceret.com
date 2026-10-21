import { describe, expect, it } from "vitest";
import { addressSchema, checkoutSchema, phoneSchema, pincodeSchema, slugify } from "@/lib/validation";

describe("validation", () => {
  it("normalises Indian phone numbers", () => {
    expect(phoneSchema.parse("+91 98765 43210")).toBe("9876543210");
    expect(phoneSchema.parse("09876543210")).toBe("9876543210");
    expect(phoneSchema.safeParse("5876543210").success).toBe(false);
    expect(phoneSchema.safeParse("98765").success).toBe(false);
  });

  it("validates PIN codes", () => {
    expect(pincodeSchema.safeParse("411001").success).toBe(true);
    expect(pincodeSchema.safeParse("011001").success).toBe(false);
    expect(pincodeSchema.safeParse("41100").success).toBe(false);
  });

  it("validates addresses", () => {
    const ok = addressSchema.safeParse({
      full_name: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Pune",
      state: "Maharashtra", pincode: "411001",
    });
    expect(ok.success).toBe(true);
    expect(addressSchema.safeParse({ full_name: "A", phone: "1", line1: "", city: "", state: "Narnia", pincode: "1" }).success).toBe(false);
  });

  it("requires a well-formed idempotency key at checkout", () => {
    const base = { address_id: "11111111-1111-4111-8111-111111111111", payment_method: "razorpay" };
    expect(checkoutSchema.safeParse({ ...base, idempotency_key: "abc" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, idempotency_key: "8f1d2c3b-aaaa-bbbb" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, payment_method: "cash", idempotency_key: "8f1d2c3b-aaaa-bbbb" }).success).toBe(false);
  });

  it("slugifies names", () => {
    expect(slugify("Roasted & Salted Pistachios (250 g)")).toBe("roasted-salted-pistachios-250-g");
  });
});
