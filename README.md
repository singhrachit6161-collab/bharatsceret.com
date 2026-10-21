# Bharat Secrets — premium dry fruits store

A full-stack Indian dry-fruits e-commerce site: storefront, cart, checkout with Razorpay and cash on delivery, customer accounts, inventory that is safe when many people buy at once, and an admin panel.

> **Brand:** Bharat Secrets. Order numbers start with `BS`.
>
> **Brand assets** in `public/brand/`:
> - `logo.png` (header, footer and admin) and `logo-full.png` (high-res), both cut out of the supplied artwork on a transparent background.
> - `hero-gift-collection.webp` and `hero-portfolio.webp` (hero slides).
> - `heritage-peacock-box.webp` (heritage section and the Gift Hampers category).
> - `artisanal-portfolio.webp` and `poster.webp` (Artisanal Portfolio section).
> - `src/app/icon.png`, `apple-icon.png` and `opengraph-image.jpg` are generated from the same artwork.
>
> **Design:** royal Indian luxury: emerald green, antique gold and ivory, Cormorant Garamond headings, palace-arch frames, gold ornaments and a damask pattern. The heritage story and its image are edited in Admin → Settings. Hero slides are edited in Admin → Homepage. Only mention export standards or certifications you actually hold.

**Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · Razorpay Standard Checkout · Zod · Vitest.

## Contents

- [Quick start](#quick-start)
- [Project layout](#project-layout)
- [Database & migrations](#database--migrations)
- [Testing](#testing)
- [Deployment](#deployment)
- [What is done / what you still need to do](#status)
- Guides: [Admin setup](docs/ADMIN_SETUP.md) · [Payments](docs/PAYMENTS.md) · [Inventory](docs/INVENTORY.md) · [Shipping](docs/SHIPPING.md) · [Security](docs/SECURITY.md)

## Quick start

1. **Install:** `npm install` (Node 20.9+).
2. **Create a Supabase project.** Use a separate *staging* project for testing.
3. **Apply the migrations** in `supabase/migrations/`, in filename order (see [Database](#database--migrations)). For a demo catalogue, also run `supabase/seed.sql`.
4. **Configure the environment:** `cp .env.example .env.local`, then fill in the values. Use **Razorpay TEST keys** to start.
5. **In Supabase Auth → URL configuration,** set the Site URL to your site and add `<site>/auth/callback` to the redirect URLs.
6. **Run:** `npm run dev` → http://localhost:3000
7. **Create your first admin.** Follow [docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md).
8. **Schedule the maintenance job.** It expires unpaid orders and releases their stock (see [docs/INVENTORY.md](docs/INVENTORY.md#scheduled-maintenance)).

If the Supabase variables are missing, the site still runs but shows a red banner saying "Store database is not configured". It never pretends to be an empty store. If Razorpay or the service key are missing, the admin header shows what is disabled.

## Project layout

```
src/
  app/(store)/          storefront: home, shop, category, search, deals, product, cart,
                        checkout (+ pay, result), account (orders, addresses, wishlist),
                        auth pages, policies, about, faq, contact, track-order
  app/admin/            admin panel (role-protected) + server actions in admin/actions/
  app/actions/          customer server actions (cart, checkout, account, auth, engagement)
  app/api/              razorpay/webhook, cron/maintenance, search/suggest, products/*
  components/           store/, admin/, ui/
  lib/                  pricing, coupons, cart cookie, razorpay signatures + webhook processor,
                        validation (zod), data access (lib/data/*), auth/roles, notifications,
                        shipping abstraction, rate limiting
  proxy.ts              refreshes Supabase session; redirects anonymous users from /account, /checkout, /admin
supabase/
  migrations/           versioned SQL: schema, business functions, RLS, storage, listing view, reporting
  seed.sql              SAMPLE catalogue, settings and policy TEMPLATES (dev/staging)
  tests/supabase_shim.sql  minimal stand-in for Supabase schemas so DB tests run on plain Postgres
tests/unit, tests/db    Vitest suites
public/placeholders/    original, clearly labelled placeholder artwork (scripts/generate-placeholders.py)
```

## Catalogue structure

Collections are nested categories (`categories.parent_id`), managed in **Admin → Collections**:

```
Dry Fruits      Almonds · Cashews · Pistachios · Walnuts · Raisins · Dates
Flavour Lab     Flavoured Nuts · Flavoured Makhana · Roasted · Build Your Own
Spices          Single Origin · Whole Spices · Ground · Regional Blends
Snacks          Makhana · Traditional Snacks · Seeds · Trail Mixes
Pantry          Honey · Pickles · Chutneys · Specialty Foods
Tea & Beverages Kahwa · Chai · Regional Tea
Regions         Kashmir · Punjab · Himachal · Uttarakhand · Rajasthan · Uttar Pradesh
Gifting         Festivals · Weddings · Corporate · Build Your Own · Luxury
```

- **Menus:** top-level collections marked "Show in menus" form the main menu. Their marked children appear in each dropdown and in the mobile menu.
- **Parent pages:** a parent collection's page lists every product in its sub-collections. For example, `/category/dry-fruits` includes almonds.
- **Coupons:** a coupon scoped to a parent collection applies to products in its sub-collections.
- **Regions:** regions are collections too. Tag a product with both its type and its region (e.g. *Walnuts* and *Kashmir*). It then appears in both places, and the product page shows a region badge.
- **Adding a region:** add it in Admin → Collections with parent *Regions*. It appears in the menu and the homepage "Explore by region" section automatically.
- **Build Your Own:** the Flavour Lab and Gifting entries are collections only, with no products seeded. An interactive mix or hamper builder is not built yet.

## Database & migrations

| Order | File | Contents |
|---|---|---|
| 1 | `20261021000001_core_schema.sql` | Tables, enums, constraints, indexes, `updated_at` triggers |
| 2 | `20261021000002_functions.sql` | Role helpers, `place_order`, payment confirmation, expiry, cancellation, refunds, inventory adjustments, review triggers, privileges |
| 3 | `20261021000003_rls.sql` | Row Level Security on every table, column-level grants |
| 4 | `20261021000004_storage.sql` | `product-images` bucket (5 MB limit; JPEG, PNG, WebP or AVIF) and admin-only write policies |
| 5 | `20261021000005_listing_view.sql` | `product_listing` view (security invoker) and popularity score |
| 6 | `20261021000006_admin_reporting.sql` | Staff-only dashboard and customer reporting functions |
| 7 | `20261021000007_brand_showcase.sql` | "Artisanal Portfolio" homepage section key |
| 8 | `20261021000008_category_tree.sql` | Nested catalogue: listings roll up to parent collections, `regions` homepage section, cycle guard |

**How to apply them:**
- **Supabase CLI:** `supabase link --project-ref <ref>`, then `supabase db push`.
- **SQL editor:** paste each file in order.

Money is stored as integer **paise** (`bigint`), with the currency stored explicitly as INR. The migrations only add objects; they never delete customer data.

**Backups and rollback:**
1. Take a backup before running migrations in production. Use Supabase Dashboard → Database → Backups (or PITR), or run `pg_dump`.
2. Apply to staging first and run the app and tests against it.
3. To roll back, restore the backup. The migrations are forward-only and have no down scripts, so a backup is your rollback plan.

## Testing

```bash
npm run typecheck && npm run lint && npm test     # unit tests always; DB tests skip without a DB
npm run build
```

**Database tests** (concurrency, idempotency, RLS) need a **throwaway** PostgreSQL 15+:

```bash
TEST_DATABASE_URL="postgresql://postgres@localhost:5432/bharat_secret_test" npm run test:db
```

The test setup **drops and recreates** that database. As a safety check, it refuses any database name that does not contain `test`. Never point it at Supabase.

## Deployment

The app deploys to Vercel or any Node 20+ host (`npm run build && npm start`).

1. Set every variable from `.env.example` in the host. `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `CRON_SECRET` must be **server-only**: never prefix them with `NEXT_PUBLIC_`.
2. Set `NEXT_PUBLIC_SITE_URL` to the production URL, and update the Supabase Auth URLs to match.
3. Add the Razorpay webhook (see [docs/PAYMENTS.md](docs/PAYMENTS.md)).
4. Schedule `GET /api/cron/maintenance` every 5 minutes, with `Authorization: Bearer $CRON_SECRET`.
5. Go live: switch to live Razorpay keys **only after** you have finished the payment test checklist.

The in-memory rate limiter protects a single instance only. For multi-instance or serverless scale, back `src/lib/rate-limit.ts` with Redis or Upstash.

## Status

### Implemented and tested

**Storefront:**
- Homepage in the reference's section order:
  - announcement bar
  - header with search suggestions
  - dark navigation bar
  - hero carousel
  - 4 category tiles
  - Bestsellers
  - Most viewed (from real, anonymised view data, hidden when there is none)
  - Latest
  - promo banners
  - Featured
  - trust strip
  - footer
- Shop, category and search pages with filters (price, pack size, stock), sorting and pagination.
- Product page: variants, stock-limited quantity, buy now, wishlist, PIN-code check, reviews, related products, recently viewed, and JSON-LD.

**Checkout:**
- Sign-in required.
- Prices, coupons, shipping and COD fee are recomputed on the server.
- Idempotency key per checkout page.
- Atomic stock reservation in the database.

**Payments:**
- Razorpay order creation.
- Signature verification and API confirmation of captured status and amount.
- Signed, idempotent webhooks.
- Retry for failed payments.
- Refunds that are confirmed by the gateway.

**Inventory:** reserve → commit → release, cancellation restock, return restock, and logged adjustments.

**Admin:**
- Dashboard
- Orders: fulfilment, shipments, cancel, refund, COD collection, restock
- Products: variants, image upload/reorder
- Categories
- Inventory
- Customers
- Coupons
- Review moderation
- Homepage banners and sections
- Policy pages
- Settings
- Support
- Newsletter export
- Audit log

**Security:** RLS on every table, role checks on every admin action, and no secrets in client code.

**Tests:** 30 unit tests and 28 database tests. The database tests include concurrent last-unit purchases, duplicate confirmations, coupon limits under concurrency, refunds and RLS.

### Requires your credentials or action before launch

- **Supabase project.** Apply the migrations and create the first owner (see [docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md)).
- **Razorpay:**
  - Add test keys and the webhook secret, then run the test checklist in [docs/PAYMENTS.md](docs/PAYMENTS.md).
  - Enable **automatic capture**.
  - Online payments were verified locally only with simulated, signed webhooks. A real test-mode checkout still needs your keys.
- **Email provider:** optional. Without it, notifications are **logged as not sent**, never claimed as sent. Auth emails (confirmation and password reset) are sent by Supabase Auth, so configure SMTP in Supabase for production.
- **Shipping:** only the manual provider exists. Staff enter the carrier and tracking details. Shiprocket or another carrier API is **not** integrated yet (see [docs/SHIPPING.md](docs/SHIPPING.md)).
- **Content and compliance:** this is the blocking item for launch.
  - Replace the sample products, prices and placeholder images.
  - Fill in the labelling fields: ingredients, manufacturer, FSSAI licence and country of origin. The admin panel will not publish a product without them.
  - Have the policy **templates** reviewed by a lawyer.
  - Add your real contact details, GSTIN and invoices if needed, and confirm FSSAI requirements.
- **Image storage:** Supabase Storage uploads are implemented, but they were not exercised in local testing, which had no Storage server.
- **Rate limiting:** in-memory only (see Deployment).
- **Guest checkout:** not offered, by design. Customers must sign in so orders, addresses and refunds stay tied to a verified account.
