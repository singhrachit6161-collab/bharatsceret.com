# Shipping & tracking

## What exists now (manual provider)

**Checkout fees** come from Admin → Settings → Shipping:
- a flat fee
- a free-shipping threshold, compared against the amount after discount
- COD rules

**PIN-code checker:**
- validates the 6-digit format
- checks it against optional serviceable PIN prefixes
- shows the store's configured delivery window

It does **not** call a carrier, and it says the estimate is the store's typical window.

**Shipments** (Admin → Order → Create/Update shipment):
- record the carrier, tracking number and an https tracking link
- record the status, plus a `shipment_events` entry with `source = manual` and the staff member who made the change
- move the order status forward automatically where the transition is valid: packed → shipped → out for delivery → delivered

Customers see shipments, tracking links and events on their order page. Delivered status can only be set by staff. Customers can never set it.

## Adding a carrier integration (e.g. Shiprocket)

1. Implement `ShippingProvider` in `src/lib/shipping/` for:
   - serviceability and rates
   - shipment creation (AWB and label)
   - tracking
2. Select it with `SHIPPING_PROVIDER=<name>` and keep credentials in `SHIPPING_PROVIDER_API_KEY` (server-only).
3. Add a webhook route that **verifies the carrier's signature or token**. Insert `shipment_events` with `source = 'carrier'` and a unique `external_event_id`, so duplicate events are ignored.
4. Keep the manual fallback for when the API is down.

Until this is built and tested with real credentials, the app does not claim any carrier integration.
