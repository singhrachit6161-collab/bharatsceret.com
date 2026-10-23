import { describe, expect, it } from "vitest";
import { computeTotals, evaluateCoupon, type CouponRule, type PricedLine } from "@/lib/pricing";

const lines: PricedLine[] = [
  { variantId: "v1", productId: "p1", categoryIds: ["almonds"], unitPricePaise: 32900, quantity: 2 },
  { variantId: "v2", productId: "p2", categoryIds: ["raisins"], unitPricePaise: 14900, quantity: 1 },
];
const shipping = { flatFeePaise: 6900, freeShippingThresholdPaise: 99900 };
const cod = { enabled: true, feePaise: 4900, minOrderPaise: 29900, maxOrderPaise: 500000 };
const now = new Date("2026-10-21T10:00:00Z");

const base: CouponRule = {
  id: "c1",
  code: "SAVE10",
  discountType: "percentage",
  discountValue: 10,
  maxDiscountPaise: null,
  minOrderPaise: 0,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
  perCustomerLimit: null,
  scope: "all",
  productIds: [],
  categoryIds: [],
  isActive: true,
};

describe("computeTotals", () => {
  it("adds flat shipping below the free threshold", () => {
    const t = computeTotals({ lines, discountPaise: 0, shipping, cod, paymentMethod: "razorpay" });
    expect(t).toMatchObject({ subtotalPaise: 80700, shippingPaise: 6900, codFeePaise: 0, totalPaise: 87600 });
  });

  it("gives free shipping at or above the threshold (after discount)", () => {
    const big = [{ ...lines[0], quantity: 4 }];
    const t = computeTotals({ lines: big, discountPaise: 0, shipping, cod, paymentMethod: "razorpay" });
    expect(t.shippingPaise).toBe(0);
    const discounted = computeTotals({ lines: big, discountPaise: 40000, shipping, cod, paymentMethod: "razorpay" });
    expect(discounted.shippingPaise).toBe(6900);
  });

  it("adds the COD fee only for COD and respects COD limits", () => {
    const t = computeTotals({ lines, discountPaise: 0, shipping, cod, paymentMethod: "cod" });
    expect(t.codFeePaise).toBe(4900);
    expect(t.totalPaise).toBe(80700 + 6900 + 4900);
    const tooBig = computeTotals({
      lines: [{ ...lines[0], quantity: 100 }],
      discountPaise: 0,
      shipping,
      cod,
      paymentMethod: "razorpay",
    });
    expect(tooBig.codAvailable).toBe(false);
    const disabled = computeTotals({ lines, discountPaise: 0, shipping, cod: { ...cod, enabled: false }, paymentMethod: "razorpay" });
    expect(disabled.codAvailable).toBe(false);
  });

  it("never lets the discount exceed the subtotal", () => {
    const t = computeTotals({ lines, discountPaise: 10_000_000, shipping, cod, paymentMethod: "razorpay" });
    expect(t.discountPaise).toBe(80700);
    // Shipping is still charged on a fully discounted order.
    expect(t.totalPaise).toBe(6900);
  });

  it("charges nothing for an empty cart", () => {
    const t = computeTotals({ lines: [], discountPaise: 0, shipping, cod, paymentMethod: "razorpay" });
    expect(t.totalPaise).toBe(0);
  });
});

describe("evaluateCoupon", () => {
  const ctx = { now, customerRedemptions: 0 };

  it("computes percentage discounts with integer flooring and caps", () => {
    expect(evaluateCoupon(base, lines, ctx)).toEqual({ ok: true, discountPaise: 8070 });
    expect(evaluateCoupon({ ...base, maxDiscountPaise: 5000 }, lines, ctx)).toEqual({ ok: true, discountPaise: 5000 });
  });

  it("caps fixed discounts at the eligible amount", () => {
    const c = { ...base, discountType: "fixed" as const, discountValue: 20000, scope: "products" as const, productIds: ["p2"] };
    expect(evaluateCoupon(c, lines, ctx)).toEqual({ ok: true, discountPaise: 14900 });
  });

  it("restricts category-scoped coupons to eligible lines", () => {
    const c = { ...base, scope: "categories" as const, categoryIds: ["almonds"] };
    expect(evaluateCoupon(c, lines, ctx)).toEqual({ ok: true, discountPaise: 6580 });
    expect(evaluateCoupon({ ...c, categoryIds: ["dates"] }, lines, ctx).ok).toBe(false);
  });

  it("rejects inactive, not-yet-started, expired and exhausted coupons", () => {
    expect(evaluateCoupon({ ...base, isActive: false }, lines, ctx).ok).toBe(false);
    expect(evaluateCoupon({ ...base, startsAt: "2026-11-01T00:00:00Z" }, lines, ctx).ok).toBe(false);
    expect(evaluateCoupon({ ...base, endsAt: "2026-10-21T10:00:00Z" }, lines, ctx).ok).toBe(false);
    expect(evaluateCoupon({ ...base, usageLimit: 5, usedCount: 5 }, lines, ctx).ok).toBe(false);
    expect(evaluateCoupon({ ...base, perCustomerLimit: 1 }, lines, { now, customerRedemptions: 1 }).ok).toBe(false);
    expect(evaluateCoupon({ ...base, minOrderPaise: 100000 }, lines, ctx).ok).toBe(false);
  });
});
