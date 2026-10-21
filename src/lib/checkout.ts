import "server-only";
import { codRules, getSettings, shippingRules } from "@/lib/data/settings";
import type { CartViewLine } from "@/lib/data/cart";
import { toPricedLines } from "@/lib/data/cart";
import { computeTotals, evaluateCoupon, type CouponRule, type Totals } from "@/lib/pricing";
import { isServiceRoleConfigured } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/server";

export interface Quote {
  totals: Totals;
  coupon: { id: string; code: string; discountPaise: number } | null;
  couponError: string | null;
}

/**
 * Load a coupon by code. Coupons are not readable by customers (RLS), so this
 * uses the service client and returns only what pricing needs.
 */
async function loadCoupon(code: string, userId: string): Promise<{ rule: CouponRule; redemptions: number } | null> {
  if (!isServiceRoleConfigured()) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("coupons")
    .select(
      "id, code, discount_type, discount_value, max_discount_paise, min_order_paise, starts_at, ends_at, usage_limit, used_count, per_customer_limit, scope, is_active, coupon_products (product_id), coupon_categories (category_id)",
    )
    .ilike("code", code.replace(/[%_]/g, ""))
    .maybeSingle();
  if (!data) return null;
  const { count } = await db
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", data.id)
    .eq("user_id", userId)
    .is("reversed_at", null);
  return {
    redemptions: count ?? 0,
    rule: {
      id: data.id,
      code: data.code,
      discountType: data.discount_type,
      discountValue: Number(data.discount_value),
      maxDiscountPaise: data.max_discount_paise === null ? null : Number(data.max_discount_paise),
      minOrderPaise: Number(data.min_order_paise),
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      usageLimit: data.usage_limit,
      usedCount: data.used_count,
      perCustomerLimit: data.per_customer_limit,
      scope: data.scope,
      productIds: (data.coupon_products ?? []).map((r: { product_id: string }) => r.product_id),
      categoryIds: (data.coupon_categories ?? []).map((r: { category_id: string }) => r.category_id),
      isActive: data.is_active,
    },
  };
}

export async function quoteCheckout(input: {
  userId: string;
  lines: CartViewLine[];
  couponCode: string | null;
  paymentMethod: "razorpay" | "cod";
}): Promise<Quote> {
  const settings = await getSettings();
  const priced = toPricedLines(input.lines);
  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;

  if (input.couponCode) {
    const loaded = await loadCoupon(input.couponCode, input.userId);
    if (!loaded) couponError = "Coupon code not found.";
    else {
      const res = evaluateCoupon(loaded.rule, priced, { now: new Date(), customerRedemptions: loaded.redemptions });
      if (res.ok) coupon = { id: loaded.rule.id, code: loaded.rule.code, discountPaise: res.discountPaise };
      else couponError = res.reason;
    }
  }

  const totals = computeTotals({
    lines: priced,
    discountPaise: coupon?.discountPaise ?? 0,
    shipping: shippingRules(settings),
    cod: codRules(settings),
    paymentMethod: input.paymentMethod,
  });
  return { totals, coupon, couponError };
}
