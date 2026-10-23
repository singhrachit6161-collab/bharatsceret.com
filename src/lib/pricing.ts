/**
 * Pure, deterministic pricing. Used for display AND by the checkout server
 * action; the database function place_order re-validates the arithmetic and
 * the unit prices against the live catalogue.
 */

export interface PricedLine {
  variantId: string;
  productId: string;
  categoryIds: string[];
  unitPricePaise: number;
  quantity: number;
}

export interface ShippingRules {
  flatFeePaise: number;
  freeShippingThresholdPaise: number | null;
}

export interface CodRules {
  enabled: boolean;
  feePaise: number;
  minOrderPaise: number;
  maxOrderPaise: number;
}

export interface CouponRule {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  scope: "all" | "products" | "categories";
  productIds: string[];
  categoryIds: string[];
  isActive: boolean;
}

export type CouponEvaluation =
  | { ok: true; discountPaise: number }
  | { ok: false; reason: string };

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0);
}

export function evaluateCoupon(
  coupon: CouponRule,
  lines: PricedLine[],
  ctx: { now: Date; customerRedemptions: number },
): CouponEvaluation {
  if (!coupon.isActive) return { ok: false, reason: "This coupon is not active." };
  if (coupon.startsAt && new Date(coupon.startsAt) > ctx.now) return { ok: false, reason: "This coupon is not active yet." };
  if (coupon.endsAt && new Date(coupon.endsAt) <= ctx.now) return { ok: false, reason: "This coupon has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (coupon.perCustomerLimit !== null && ctx.customerRedemptions >= coupon.perCustomerLimit) {
    return { ok: false, reason: "You have already used this coupon." };
  }
  const subtotal = subtotalOf(lines);
  if (subtotal < coupon.minOrderPaise) {
    return { ok: false, reason: `Add items worth more to use this coupon (minimum order applies).` };
  }

  const eligibleLines = lines.filter((l) => {
    if (coupon.scope === "products") return coupon.productIds.includes(l.productId);
    if (coupon.scope === "categories") return l.categoryIds.some((c) => coupon.categoryIds.includes(c));
    return true;
  });
  const eligible = subtotalOf(eligibleLines);
  if (eligible <= 0) return { ok: false, reason: "This coupon does not apply to the items in your cart." };

  let discount =
    coupon.discountType === "percentage"
      ? Math.floor((eligible * coupon.discountValue) / 100)
      : Math.min(coupon.discountValue, eligible);
  if (coupon.maxDiscountPaise !== null) discount = Math.min(discount, coupon.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, subtotal));
  if (discount === 0) return { ok: false, reason: "This coupon does not apply to the items in your cart." };
  return { ok: true, discountPaise: discount };
}

export interface Totals {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  totalPaise: number;
  codAvailable: boolean;
  codUnavailableReason: string | null;
}

export function computeTotals(input: {
  lines: PricedLine[];
  discountPaise: number;
  shipping: ShippingRules;
  cod: CodRules;
  paymentMethod: "razorpay" | "cod";
}): Totals {
  const subtotal = subtotalOf(input.lines);
  const discount = Math.max(0, Math.min(input.discountPaise, subtotal));
  const afterDiscount = subtotal - discount;

  const freeShipping =
    input.shipping.freeShippingThresholdPaise !== null && afterDiscount >= input.shipping.freeShippingThresholdPaise;
  const shipping = subtotal === 0 || freeShipping ? 0 : Math.max(0, input.shipping.flatFeePaise);

  let codUnavailableReason: string | null = null;
  const preCod = afterDiscount + shipping;
  if (!input.cod.enabled) codUnavailableReason = "Cash on delivery is currently unavailable.";
  else if (preCod < input.cod.minOrderPaise) codUnavailableReason = "Order value is below the cash-on-delivery minimum.";
  else if (preCod > input.cod.maxOrderPaise) codUnavailableReason = "Order value exceeds the cash-on-delivery limit.";
  const codAvailable = codUnavailableReason === null;

  const codFee = input.paymentMethod === "cod" ? Math.max(0, input.cod.feePaise) : 0;
  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    shippingPaise: shipping,
    codFeePaise: codFee,
    totalPaise: afterDiscount + shipping + codFee,
    codAvailable,
    codUnavailableReason,
  };
}
