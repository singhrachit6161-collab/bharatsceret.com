"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { quoteCheckout, type Quote } from "@/lib/checkout";
import { getCartView, writeCart } from "@/lib/data/cart";
import { getSettings } from "@/lib/data/settings";
import { errorCode, friendlyError } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { fetchGatewayPayment, getRazorpay } from "@/lib/razorpay";
import { verifyCheckoutSignature } from "@/lib/razorpay-signature";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isRazorpayConfigured, isServiceRoleConfigured, serverEnv } from "@/lib/server-env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkoutSchema, fieldErrors, verifyPaymentSchema } from "@/lib/validation";

export async function previewCheckout(input: {
  couponCode: string | null;
  paymentMethod: "razorpay" | "cod";
}): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const method = input.paymentMethod === "cod" ? "cod" : "razorpay";
  const code = input.couponCode ? z.string().trim().max(30).parse(input.couponCode).toUpperCase() : null;
  const lines = await getCartView();
  if (!lines.length) return { ok: false, error: "Your cart is empty." };
  return { ok: true, quote: await quoteCheckout({ userId: user.id, lines, couponCode: code, paymentMethod: method }) };
}

export type PlaceOrderState =
  | null
  | { ok: false; error: string; errors?: Record<string, string> }
  | { ok: true; orderId: string; orderNumber: string; next: "pay" | "confirmed" };

export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to place your order." };
  if (!rateLimit(`checkout:${user.id}`, 10, 60_000) || !rateLimit(`checkout-ip:${await clientIp()}`, 30, 60_000)) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
  }
  if (!isServiceRoleConfigured()) return { ok: false, error: "Checkout is not available yet. Please contact support." };

  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (input.payment_method === "razorpay" && !isRazorpayConfigured()) {
    return { ok: false, error: "Online payment is not available right now. Please choose another method." };
  }

  const supabase = await createClient();
  const { data: address } = await supabase
    .from("addresses")
    .select("full_name, phone, line1, line2, landmark, city, state, pincode")
    .eq("id", input.address_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!address) return { ok: false, error: "Please select a valid delivery address." };

  const lines = await getCartView();
  if (!lines.length) return { ok: false, error: "Your cart is empty." };
  if (lines.some((l) => l.issue)) {
    return { ok: false, error: "Some items in your cart are unavailable or exceed available stock. Please review your cart." };
  }

  const quote = await quoteCheckout({
    userId: user.id,
    lines,
    couponCode: input.coupon_code,
    paymentMethod: input.payment_method,
  });
  if (input.coupon_code && !quote.coupon) return { ok: false, error: quote.couponError ?? "Coupon is not valid." };
  if (input.payment_method === "cod" && !quote.totals.codAvailable) {
    return { ok: false, error: quote.totals.codUnavailableReason ?? "Cash on delivery is not available for this order." };
  }

  const settings = await getSettings();
  const { data, error } = await createServiceClient().rpc("place_order", {
    p_user_id: user.id,
    p_idempotency_key: input.idempotency_key,
    p_payment_method: input.payment_method,
    p_items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, unit_price_paise: l.unitPricePaise })),
    p_subtotal_paise: quote.totals.subtotalPaise,
    p_discount_paise: quote.totals.discountPaise,
    p_shipping_paise: quote.totals.shippingPaise,
    p_cod_fee_paise: quote.totals.codFeePaise,
    p_total_paise: quote.totals.totalPaise,
    p_coupon_id: quote.coupon?.id ?? null,
    p_shipping_address: address,
    p_contact_email: user.email,
    p_contact_phone: address.phone,
    p_customer_note: input.note,
    p_reservation_minutes: settings.checkout.reservation_minutes,
  });
  if (error || !data?.[0]) {
    if (!errorCode(error)) console.error("[checkout] place_order failed", error?.code);
    return { ok: false, error: friendlyError(error, "We could not place your order. Please try again.") };
  }
  const order = data[0] as { order_id: string; order_number: string; created: boolean };

  if (input.payment_method === "cod") {
    await writeCart([]);
    if (order.created) {
      await notify("order_confirmed", { to: user.email, orderNumber: order.order_number, totalPaise: quote.totals.totalPaise });
    }
    revalidatePath("/", "layout");
    return { ok: true, orderId: order.order_id, orderNumber: order.order_number, next: "confirmed" };
  }
  // Online payment: keep the cart until the payment is confirmed.
  return { ok: true, orderId: order.order_id, orderNumber: order.order_number, next: "pay" };
}

export interface PaymentSession {
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
}

/** Create (or reuse) the Razorpay order for a pending DB order. Amount always comes from the DB. */
export async function startPayment(orderId: string): Promise<{ ok: true; session: PaymentSession } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "Invalid order." };
  if (!isRazorpayConfigured()) return { ok: false, error: "Online payment is not configured." };
  if (!rateLimit(`pay:${user.id}`, 20, 60_000)) return { ok: false, error: "Too many attempts. Please wait a minute." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, user_id, status, total_paise, shipping_address, contact_email, contact_phone, reservation_expires_at, payments (provider_order_id, status, amount_paise)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "pending_payment") return { ok: false, error: friendlyError({ message: "ORDER_NOT_PAYABLE" }) };
  if (order.reservation_expires_at && new Date(order.reservation_expires_at) < new Date()) {
    return { ok: false, error: "The payment window for this order has expired. Please place the order again." };
  }

  const total = Number(order.total_paise);
  const reusable = ((order.payments ?? []) as { provider_order_id: string; status: string; amount_paise: number }[]).find(
    (p) => Number(p.amount_paise) === total && (p.status === "created" || p.status === "failed"),
  );
  let providerOrderId = reusable?.provider_order_id;
  if (!providerOrderId) {
    try {
      const rp = await getRazorpay().orders.create({
        amount: total,
        currency: "INR",
        receipt: order.order_number,
        notes: { order_id: order.id, order_number: order.order_number },
      });
      providerOrderId = rp.id;
    } catch {
      console.error("[payment] Razorpay order creation failed for", order.order_number);
      return { ok: false, error: "Could not start the payment. Please try again." };
    }
    const { error } = await createServiceClient().rpc("register_payment_attempt", {
      p_order_id: order.id,
      p_provider_order_id: providerOrderId,
      p_amount_paise: total,
    });
    if (error) return { ok: false, error: friendlyError(error) };
  }

  const addr = order.shipping_address as { full_name?: string };
  return {
    ok: true,
    session: {
      keyId: serverEnv.razorpayKeyId,
      providerOrderId,
      amountPaise: total,
      currency: "INR",
      orderNumber: order.order_number,
      prefill: { name: addr.full_name ?? "", email: order.contact_email ?? "", contact: order.contact_phone ?? "" },
    },
  };
}

/**
 * Verify the Checkout handler response. The signature proves the response came
 * from Razorpay for this order; the payment's captured status and amount are
 * then confirmed via the Razorpay API before the order is marked paid.
 */
export async function verifyPayment(input: unknown): Promise<{ ok: true; status: "confirmed" | "processing" } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = verifyPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment response." };
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (!verifyCheckoutSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature }, serverEnv.razorpayKeySecret)) {
    console.warn("[payment] signature verification failed for", razorpay_order_id);
    return { ok: false, error: "Payment could not be verified." };
  }

  // The payment must belong to an order owned by this user.
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("provider_order_id, amount_paise, orders!inner (id, order_number, user_id, total_paise, contact_email)")
    .eq("provider_order_id", razorpay_order_id)
    .maybeSingle();
  const order = payment?.orders as unknown as { id: string; order_number: string; user_id: string; total_paise: number; contact_email: string | null } | undefined;
  if (!payment || !order || order.user_id !== user.id) return { ok: false, error: "Payment not found." };

  let gateway;
  try {
    gateway = await fetchGatewayPayment(razorpay_payment_id);
  } catch {
    return { ok: true, status: "processing" };
  }
  if (gateway.order_id !== razorpay_order_id || gateway.amount !== Number(payment.amount_paise) || gateway.currency !== "INR") {
    console.warn("[payment] gateway payment does not match order", razorpay_order_id);
    return { ok: false, error: "Payment details did not match your order. Please contact support." };
  }

  const service = createServiceClient();
  if (gateway.status === "captured") {
    const { data: outcome, error } = await service.rpc("confirm_online_payment", {
      p_provider_order_id: razorpay_order_id,
      p_provider_payment_id: razorpay_payment_id,
      p_amount_paise: gateway.amount,
      p_method: gateway.method,
    });
    if (error) return { ok: false, error: friendlyError(error, "We could not confirm your payment yet.") };
    await writeCart([]);
    if (outcome === "confirmed" || outcome === "late_confirmed") {
      await notify("payment_confirmed", { to: order.contact_email, orderNumber: order.order_number, totalPaise: Number(order.total_paise) });
    }
    revalidatePath("/", "layout");
    return { ok: true, status: outcome === "on_hold" ? "processing" : "confirmed" };
  }
  if (gateway.status === "authorized") {
    await service
      .from("payments")
      .update({ status: "authorized", provider_payment_id: razorpay_payment_id })
      .eq("provider_order_id", razorpay_order_id)
      .in("status", ["created", "failed"]);
    await writeCart([]);
    return { ok: true, status: "processing" };
  }
  return { ok: false, error: "Payment was not completed. You can try again." };
}

export async function reportPaymentFailure(input: { orderId: string; code?: string; description?: string; providerOrderId?: string; paymentId?: string }) {
  const user = await getSessionUser();
  if (!user || !input.providerOrderId) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("provider_order_id, orders!inner (user_id)")
    .eq("provider_order_id", input.providerOrderId)
    .maybeSingle();
  if (!data || (data.orders as unknown as { user_id: string }).user_id !== user.id) return;
  // Informational only: the order stays payable until its window expires.
  await createServiceClient().rpc("record_payment_failure", {
    p_provider_order_id: input.providerOrderId,
    p_provider_payment_id: input.paymentId?.startsWith("pay_") ? input.paymentId : null,
    p_error_code: input.code?.slice(0, 100) ?? null,
    p_error_description: input.description?.slice(0, 300) ?? null,
  });
}
