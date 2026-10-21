-- Bharat Secret core schema
-- Money is stored as integer paise (bigint). Currency is stored explicitly (INR).
-- All primary keys are UUIDs unless noted.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'admin', 'operations');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum (
  'pending_payment',  -- online order created, waiting for payment
  'confirmed',        -- paid (online) or accepted (COD)
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'payment_failed',   -- payment window expired without a captured payment
  'on_hold',          -- needs manual review (e.g. paid after reservation expired and stock gone)
  'refunded',
  'partially_refunded'
);
create type public.payment_method as enum ('razorpay', 'cod');
create type public.order_payment_status as enum (
  'pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'cod_pending', 'cod_collected'
);
create type public.payment_record_status as enum (
  'created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'
);
create type public.refund_status as enum ('pending', 'processed', 'failed');
create type public.reservation_status as enum ('active', 'committed', 'released');
create type public.movement_reason as enum (
  'initial', 'adjustment', 'reservation', 'reservation_release', 'sale',
  'cancellation_restock', 'return_restock'
);
create type public.discount_type as enum ('percentage', 'fixed');
create type public.coupon_scope as enum ('all', 'products', 'categories');
create type public.banner_placement as enum ('hero', 'category_tile', 'promo');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.shipment_status as enum (
  'pending', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'cancelled'
);
create type public.support_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1 text not null check (char_length(line1) between 3 and 200),
  line2 text check (char_length(line2) <= 200),
  landmark text check (char_length(landmark) <= 120),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  show_in_nav boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand text not null default 'Bharat Secret',
  short_description text check (char_length(short_description) <= 300),
  description text,
  ingredients text,
  storage_instructions text,
  allergen_info text,
  shelf_life text,
  country_of_origin text,
  manufacturer_info text,
  fssai_license text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  featured_rank integer not null default 0,
  is_bestseller boolean not null default false,
  bestseller_rank integer not null default 0,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  og_image_url text,
  review_count integer not null default 0 check (review_count >= 0),
  rating_avg numeric(3, 2) check (rating_avg is null or rating_avg between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_published_idx on public.products (status, published_at desc);
create index products_featured_idx on public.products (is_featured, featured_rank) where is_featured;
create index products_bestseller_idx on public.products (is_bestseller, bestseller_rank) where is_bestseller;
create index products_search_idx on public.products
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(short_description, '')));

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  price_paise bigint not null check (price_paise >= 0),
  compare_at_paise bigint check (compare_at_paise is null or compare_at_paise > price_paise),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  max_per_order integer not null default 10 check (max_per_order between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text,
  url text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Privacy-conscious view tracking: no user id, no IP; just a product and a
-- coarse, salted, daily-rotating session hash used to de-duplicate views.
create table public.product_view_events (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  session_hash text not null,
  viewed_on date not null default current_date,
  viewed_at timestamptz not null default now(),
  unique (product_id, session_hash, viewed_on)
);
create index product_view_events_recent_idx on public.product_view_events (viewed_on, product_id);

-- ---------------------------------------------------------------------------
-- Inventory
-- available = on_hand - reserved, enforced non-negative by constraints.
-- ---------------------------------------------------------------------------
create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_le_on_hand check (reserved <= on_hand)
);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  reason public.movement_reason not null,
  delta_on_hand integer not null default 0,
  delta_reserved integer not null default 0,
  order_id uuid,
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_idx on public.inventory_movements (order_id);

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique check (code ~ '^[A-Za-z0-9_-]{3,30}$'),
  description text,
  discount_type public.discount_type not null,
  discount_value bigint not null check (discount_value > 0),
  max_discount_paise bigint check (max_discount_paise is null or max_discount_paise > 0),
  min_order_paise bigint not null default 0 check (min_order_paise >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  scope public.coupon_scope not null default 'all',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percentage_range check (discount_type <> 'percentage' or discount_value between 1 and 100),
  constraint coupons_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.coupon_products (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (coupon_id, product_id)
);

create table public.coupon_categories (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (coupon_id, category_id)
);

create table public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  placement public.banner_placement not null,
  title text not null check (char_length(title) between 1 and 120),
  subtitle text,
  cta_label text,
  link_url text not null check (link_url ~ '^/'),
  image_url text not null,
  mobile_image_url text,
  alt text not null default '',
  theme text not null default 'walnut' check (theme in ('walnut', 'saffron', 'olive', 'cream')),
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index homepage_banners_placement_idx on public.homepage_banners (placement, is_active, sort_order);

create table public.homepage_sections (
  key text primary key check (key in ('category_tiles', 'bestsellers', 'most_viewed', 'latest', 'promo_banners', 'featured')),
  title text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  item_limit integer not null default 8 check (item_limit between 1 and 24),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users (id) on delete restrict,
  status public.order_status not null,
  payment_method public.payment_method not null,
  payment_status public.order_payment_status not null,
  currency char(3) not null default 'INR' check (currency = 'INR'),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  shipping_paise bigint not null default 0 check (shipping_paise >= 0),
  cod_fee_paise bigint not null default 0 check (cod_fee_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  refunded_paise bigint not null default 0 check (refunded_paise >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  shipping_address jsonb not null,
  contact_email text,
  contact_phone text not null,
  customer_note text check (char_length(customer_note) <= 500),
  idempotency_key text not null,
  reservation_expires_at timestamptz,
  stock_restored_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_math check (total_paise = subtotal_paise - discount_paise + shipping_paise + cod_fee_paise),
  constraint orders_discount_le_subtotal check (discount_paise <= subtotal_paise),
  constraint orders_refund_le_total check (refunded_paise <= total_paise),
  unique (user_id, idempotency_key)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_reservation_expiry_idx on public.orders (reservation_expires_at) where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_label text not null,
  sku text not null,
  image_url text,
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  quantity integer not null check (quantity > 0),
  line_total_paise bigint not null,
  constraint order_items_line_math check (line_total_paise = unit_price_paise * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, variant_id)
);
create index inventory_reservations_status_idx on public.inventory_reservations (status, expires_at);

alter table public.inventory_movements
  add constraint inventory_movements_order_fk foreign key (order_id) references public.orders (id) on delete set null;

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  discount_paise bigint not null check (discount_paise >= 0),
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_order_id text not null unique,
  provider_payment_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR',
  status public.payment_record_status not null default 'created',
  method text,
  error_code text,
  error_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  provider_refund_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  status public.refund_status not null default 'pending',
  reason text not null check (char_length(reason) between 3 and 500),
  requested_by uuid references auth.users (id) on delete set null,
  idempotency_key text not null unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text not null,
  entity_id text,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 10 and 2000),
  status public.review_status not null default 'pending',
  is_verified_purchase boolean not null default false,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index product_reviews_product_idx on public.product_reviews (product_id, status, created_at desc);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  order_number text,
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  status public.support_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_status_idx on public.support_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Fulfilment
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  carrier text not null check (char_length(carrier) between 2 and 80),
  tracking_number text,
  tracking_url text check (tracking_url is null or tracking_url ~ '^https://'),
  provider_shipment_id text,
  status public.shipment_status not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);
create unique index shipments_carrier_tracking_idx on public.shipments (carrier, tracking_number) where tracking_number is not null;

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status public.shipment_status not null,
  description text,
  location text,
  source text not null check (source in ('manual', 'carrier')),
  external_event_id text,
  actor_id uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (shipment_id, external_event_id)
);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.store_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.content_pages (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  body text not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'addresses', 'categories', 'products', 'product_variants', 'coupons',
    'homepage_banners', 'homepage_sections', 'orders', 'inventory_reservations', 'payments', 'refunds',
    'product_reviews', 'newsletter_subscribers', 'support_requests', 'shipments', 'inventory',
    'store_settings', 'content_pages'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;
