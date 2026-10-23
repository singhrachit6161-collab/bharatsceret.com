# Inventory & stock safety

Stock is tracked per variant (SKU) in `inventory(on_hand, reserved)`:
- `available = on_hand − reserved`.
- CHECK constraints keep `on_hand ≥ 0`, `reserved ≥ 0` and `reserved ≤ on_hand`.

## When stock changes

| Event | on_hand | reserved | Function |
|---|---|---|---|
| Online order placed | — | +qty | `place_order` (conditional `UPDATE … WHERE on_hand − reserved ≥ qty`) |
| Payment captured | −qty | −qty | `confirm_online_payment` (once; reservation → `committed`) |
| Payment window expires | — | −qty | `expire_pending_orders` (once; reservation → `released`) |
| COD order placed | −qty | — | `place_order` (committed immediately) |
| Cancellation before shipping | +committed qty | −active qty | `cancel_order` (once, `stock_restored_at`) |
| Return received | +qty | — | `restock_returned_order` (once) |
| Manual adjustment | ±qty | — | `adjust_inventory` (staff, reason required) |

Every change writes an `inventory_movements` row with the reason, order, actor and timestamp.

## Why concurrency is safe

- Each stock change is a single conditional `UPDATE`. Postgres takes a row lock and re-checks the condition after any concurrent transaction commits, so two buyers can never both take the last unit.
- Order rows are locked (`FOR UPDATE`) before any state transition. Inventory rows are updated in `variant_id` order to avoid deadlocks.
- Duplicate payment confirmations, duplicate webhooks, repeated expiry runs and repeated cancellations are no-ops, because each transition checks reservation and order state.
- `tests/db/orders-inventory.test.ts` covers this:
  - 8 concurrent buyers for 1 unit → exactly 1 succeeds
  - 10 COD buyers for 3 units → 3 succeed
  - duplicate confirmations
  - expiry, followed by a late payment
  - coupon limits under concurrency

## Reservation window

The window defaults to 30 minutes (Admin → Settings → Checkout, 5–120 minutes). Orders with an `authorized` payment are not expired while a capture is in flight.

## Scheduled maintenance

`GET /api/cron/maintenance` with header `Authorization: Bearer $CRON_SECRET` runs every few minutes. It:
- expires unpaid orders and releases their reservations
- refreshes `products.popularity_score`
- deletes view events older than 90 days

How to schedule it:
- Vercel Cron (Pro plans allow 5-minute schedules), a GitHub Actions schedule, cron-job.org, or
- `pg_cron` in Supabase, calling the SQL directly: `select public.expire_pending_orders(); select public.refresh_product_popularity();`

## Low stock

Each variant has a `low_stock_threshold` (editable in Admin → Inventory). The dashboard lists variants at or below their threshold.
