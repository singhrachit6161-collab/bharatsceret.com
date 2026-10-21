/** Translate database / domain error codes into safe, customer-friendly text. */
const MESSAGES: Record<string, string> = {
  OUT_OF_STOCK: "Sorry, one of the items in your cart just went out of stock. Please review your cart.",
  PRICE_CHANGED: "A price in your cart has changed. Please review your cart and try again.",
  VARIANT_UNAVAILABLE: "One of the items in your cart is no longer available.",
  INVALID_QUANTITY: "One of the quantities in your cart is not allowed.",
  DUPLICATE_ITEMS: "Your cart contains duplicate items. Please refresh and try again.",
  EMPTY_CART: "Your cart is empty.",
  TOO_MANY_ITEMS: "Your cart has too many different items.",
  TOTAL_MISMATCH: "Your order total changed. Please review your cart and try again.",
  TOTAL_TOO_LOW: "Order total is too low for online payment.",
  COUPON_INVALID: "This coupon is not valid for your cart.",
  COUPON_LIMIT_REACHED: "You have already used this coupon.",
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_NOT_PAYABLE: "This order can no longer be paid. Please place a new order.",
  AMOUNT_MISMATCH: "Payment amount did not match the order.",
  NOT_CANCELLABLE: "This order can no longer be cancelled.",
  FORBIDDEN: "You are not allowed to perform this action.",
  REASON_REQUIRED: "Please provide a reason.",
  INVALID_TRANSITION: "That status change is not allowed for this order.",
  INSUFFICIENT_STOCK: "Stock cannot go below the quantity already reserved or zero.",
  NOT_REFUNDABLE: "This order has no captured online payment to refund.",
  REFUND_EXCEEDS_BALANCE: "Refund amount exceeds the refundable balance.",
  ALREADY_RESTOCKED: "Stock for this order has already been restored.",
};

export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  return MESSAGES[message] ?? fallback;
}

export function errorCode(error: unknown): string | null {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  return message in MESSAGES ? message : null;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
