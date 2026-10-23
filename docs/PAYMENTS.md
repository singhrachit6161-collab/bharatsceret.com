# Razorpay payments

## How it works

1. **Place order.** `placeOrder` re-prices the cart on the server, then calls `place_order(...)` in the database. That function locks rows, checks prices, stock and coupon limits, and reserves stock. The order is created in `pending_payment`.
2. **Start payment.** `startPayment` creates a Razorpay order using `amount = orders.total_paise` from the database (never the browser's amount), with currency INR and receipt = order number. It then records the payment attempt with `register_payment_attempt`. A retry reuses the same Razorpay order.
3. **Checkout.** The browser opens Razorpay Standard Checkout (`checkout.js`).
4. **Verify payment.** `verifyPayment` checks `HMAC_SHA256(order_id|payment_id, KEY_SECRET)` with a constant-time comparison. It then **fetches the payment from the Razorpay API** and requires the same `order_id`, the same amount, INR, and status `captured`. Only then does it call `confirm_online_payment`, which commits the stock exactly once.
5. **Webhook** (`POST /api/razorpay/webhook`):
   - The signature is checked on the **exact raw body** with `RAZORPAY_WEBHOOK_SECRET`.
   - `X-Razorpay-Event-Id` is stored in `payment_webhook_events`, so duplicate deliveries do nothing.
   - If processing fails, the event is marked `failed` and the endpoint returns 500, so Razorpay retries it.
6. **Confirmation page.** The result page shows "confirmed" only when the **database** says so. While a payment is still being confirmed, it polls.

Handled events:

| Event | What happens |
|---|---|
| `payment.captured`, `order.paid` | Confirms the order (idempotent). |
| `payment.authorized` | Records the payment as authorised. Unpaid-order expiry skips these orders. |
| `payment.failed` | Records the failure. The order stays payable until its reservation expires. |
| `refund.created` / `refund.processed` / `refund.failed` | Updates the refund status. Amounts are applied to the order only on `processed`, and only once. |

Edge cases:
- **Payment after expiry:** stock is re-allocated if available. Otherwise the order goes `on_hold` and needs a refund.
- **Second capture on a paid order:** flagged in history and the audit log for a refund.

## Setup (TEST mode first)

1. **Keys.** Razorpay Dashboard (Test mode) → API Keys → generate a key. Set `RAZORPAY_KEY_ID=rzp_test_…` and `RAZORPAY_KEY_SECRET`. The site shows a **TEST MODE** banner whenever the key isn't `rzp_live_`.
2. **Automatic capture.** Account & Settings → Payment capture → **Automatic**. Without it, payments stay `authorized` and are not confirmed. This app does not capture manually.
3. **Webhook.** Webhooks → Add:
   - URL: `https://<your-site>/api/razorpay/webhook`
   - Secret: a strong random value, also set as `RAZORPAY_WEBHOOK_SECRET`.
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.

   For local testing, expose the dev server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`).

## Test checklist (do all of these before using live keys)

Use Razorpay's documented test cards, UPI IDs and netbanking flows.

- [ ] Successful card payment → order `confirmed`/`paid`, stock decremented once, cart cleared.
- [ ] Successful UPI payment.
- [ ] Failed payment → error shown, order still payable, **Retry payment** works without a new order.
- [ ] Close the checkout modal → no charge, order stays `pending_payment`.
- [ ] Let an unpaid order expire (lower the reservation window in Settings), run the cron → order `payment_failed`, stock released.
- [ ] Webhook redelivery from the Razorpay dashboard → response `duplicate`, nothing changes.
- [ ] Partial refund from admin, then full refund → statuses update when Razorpay reports `processed`.
- [ ] Refund more than the balance → rejected.
- [ ] Double-click "Place order" → only one order (idempotency key).
- [ ] Two browsers buying the last unit → only one succeeds.

## Going live

Switch to `rzp_live_` keys, create a **separate live webhook** with its own secret, and place one small real order and refund it.

**Never** log or store card numbers, CVV or UPI PINs. This app never receives them: Razorpay's checkout handles them.

## Refunds

Only owner/admin can issue refunds, from the order page in admin. Each refund needs:
- an amount (at most the refundable balance)
- a reason
- typing `REFUND` to confirm
- a one-time idempotency key, generated per form

Steps:
1. A `refunds` row is created as `pending`.
2. The Razorpay refund API is called with `notes.refund_request_id`.
3. The status becomes `processed` only when Razorpay says so, either in the API response or a verified webhook.
4. If the call fails, the refund is marked `failed` with the reason and audit-logged.

Restocking returned goods is a **separate** action ("Return restock"), because refunding money and restocking goods are independent.
