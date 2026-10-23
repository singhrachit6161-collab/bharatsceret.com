# Shipping & tracking

Two providers are available. Choose one with `SHIPPING_PROVIDER`.

## Manual (default)

**Checkout fees** come from Admin → Settings → Shipping:
- a flat fee
- a free-shipping threshold, compared against the amount after discount
- COD rules

**PIN-code checker:** validates the 6-digit format, checks the optional serviceable PIN prefixes, and shows the store's configured delivery window. It says the estimate is the store's typical window.

**Shipments** (Admin → Order → Create/Update shipment) record the carrier, tracking number, an https tracking link and a status. Each update adds a `shipment_events` entry with `source = manual` and the staff member's name, and moves the order forward where the transition is valid (packed → shipped → out for delivery → delivered). Customers see the shipment, link and events on their order page. Only staff or a verified carrier event can mark an order delivered.

## Shiprocket

Shiprocket books shipments with many courier partners from one account.

### Setup
1. In Shiprocket, add your pickup address (Settings → Pickup addresses) and note its **nickname**.
2. Create an **API user** (Settings → API → Configure → Create an API user). Use a dedicated email address, not your login.
3. Set these variables on the server:
   - `SHIPPING_PROVIDER=shiprocket`
   - `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` (the API user)
   - `SHIPROCKET_PICKUP_LOCATION` (the exact nickname)
   - `SHIPROCKET_PICKUP_PINCODE`
4. Set your courier priority in Shiprocket. When an order is booked, Shiprocket picks the courier from that priority.
5. **Tracking webhook** (Settings → API → Webhooks):
   - URL: `https://<your-site>/api/shipping/webhook`. The path deliberately avoids the word "shiprocket", which Shiprocket rejects in webhook URLs.
   - Token: a long random string. Put the same value in `SHIPROCKET_WEBHOOK_TOKEN`. Requests without the matching `x-api-key` header get a 401.

### What it does
- **PIN-code checker:** asks Shiprocket which couriers serve the PIN and shows their estimated days. Your own excluded PIN prefixes still apply. If the API fails, the store's rules are used instead.
- **Ship with Shiprocket** (Admin → Order, for confirmed, processing or packed orders). Enter the package weight (suggested from pack sizes plus 15% for packaging) and dimensions, then book. This:
  1. creates the Shiprocket order (COD or Prepaid);
  2. assigns an AWB number;
  3. schedules pickup;
  4. fetches the label, shown on the order as "Download label (PDF)".
  
  The order moves to **Packed** and the invoice is issued. If a step fails, booking again reuses the same Shiprocket shipment, so no duplicate is created.
- **Tracking updates:** each webhook event is stored once (duplicates are ignored). The shipment status is updated, and the order only ever moves forward. Customers get dispatch, out-for-delivery and delivered emails. RTO and cancellation events are recorded on the shipment but never change the order automatically; staff handle those.

### Before going live
- **Check the COD amount.** Book one COD test order and confirm the amount to collect shown in Shiprocket equals the order total. The app sends item prices as `sub_total`, shipping as `shipping_charges`, the COD fee as `transaction_charges` and the coupon as `total_discount`.
- **Check the label and pickup.** Confirm the label prints correctly and the pickup is scheduled for your address.
- **Shipping fees are not live-rated.** Checkout fees still come from your store settings, not from Shiprocket rates. Set them to cover your typical courier cost.

The Shiprocket integration was built against Shiprocket's public API and tested with simulated responses and webhooks. It has **not** been run against a real Shiprocket account. Do a test booking before relying on it.
