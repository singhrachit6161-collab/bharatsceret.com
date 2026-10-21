-- Row Level Security. Every table has RLS enabled; anything not explicitly
-- allowed is denied. Writes to orders, payments, inventory, reservations,
-- coupons usage and refunds happen only through the security-definer
-- functions in 20261021000002_functions.sql or trusted server code.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'addresses', 'categories', 'products', 'product_categories', 'product_variants',
    'product_images', 'product_view_events', 'inventory', 'inventory_movements', 'inventory_reservations',
    'coupons', 'coupon_products', 'coupon_categories', 'coupon_redemptions', 'homepage_banners',
    'homepage_sections', 'orders', 'order_items', 'order_status_history', 'payments', 'refunds',
    'payment_webhook_events', 'wishlist_items', 'product_reviews', 'newsletter_subscribers',
    'support_requests', 'shipments', 'shipment_events', 'audit_logs', 'store_settings', 'content_pages'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Profiles ------------------------------------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Only these columns are user-editable.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- Roles: users can see their own roles; staff can see all. No client writes:
-- roles are provisioned via SQL by the owner (see docs/ADMIN_SETUP.md).
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
revoke insert, update, delete on public.user_roles from anon, authenticated;

-- Addresses -------------------------------------------------------------------
create policy addresses_own on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy addresses_staff_read on public.addresses for select to authenticated
  using ((select public.is_staff()));

-- Catalog: public reads of published data; admin writes --------------------
create policy categories_public_read on public.categories for select to anon, authenticated
  using (is_visible or (select public.is_staff()));
create policy categories_admin_write on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy products_public_read on public.products for select to anon, authenticated
  using ((status = 'active' and (published_at is null or published_at <= now())) or (select public.is_staff()));
create policy products_admin_write on public.products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Rating aggregates are maintained by trigger only: exclude them from the
-- columns clients may update.
revoke update on public.products from anon, authenticated;
grant update (
  name, slug, brand, short_description, description, ingredients, storage_instructions, allergen_info,
  shelf_life, country_of_origin, manufacturer_info, fssai_license, status, is_featured, featured_rank,
  is_bestseller, bestseller_rank, published_at, seo_title, seo_description, og_image_url
) on public.products to authenticated;

create policy product_categories_public_read on public.product_categories for select to anon, authenticated
  using (true);
create policy product_categories_admin_write on public.product_categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy product_variants_public_read on public.product_variants for select to anon, authenticated
  using (true);
create policy product_variants_admin_write on public.product_variants for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy product_images_public_read on public.product_images for select to anon, authenticated
  using (true);
create policy product_images_admin_write on public.product_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- View events: service role only (no policies for clients).
revoke all on public.product_view_events from anon, authenticated;

-- Inventory: availability is public; only the threshold is directly editable
-- by staff. Quantities change only through functions.
create policy inventory_public_read on public.inventory for select to anon, authenticated using (true);
create policy inventory_staff_threshold on public.inventory for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
revoke insert, update, delete on public.inventory from anon, authenticated;
grant update (low_stock_threshold) on public.inventory to authenticated;

create policy inventory_movements_staff_read on public.inventory_movements for select to authenticated
  using ((select public.is_staff()));
revoke insert, update, delete on public.inventory_movements from anon, authenticated;

create policy inventory_reservations_staff_read on public.inventory_reservations for select to authenticated
  using ((select public.is_staff()));
revoke insert, update, delete on public.inventory_reservations from anon, authenticated;

-- Promotions: coupon rules are never exposed to customers.
create policy coupons_admin on public.coupons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy coupons_staff_read on public.coupons for select to authenticated using ((select public.is_staff()));
-- used_count is maintained by place_order/cancellation only.
revoke update on public.coupons from anon, authenticated;
grant update (
  code, description, discount_type, discount_value, max_discount_paise, min_order_paise, starts_at, ends_at,
  usage_limit, per_customer_limit, scope, is_active
) on public.coupons to authenticated;
create policy coupon_products_admin on public.coupon_products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy coupon_categories_admin on public.coupon_categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy coupon_redemptions_staff_read on public.coupon_redemptions for select to authenticated
  using ((select public.is_staff()));
revoke insert, update, delete on public.coupon_redemptions from anon, authenticated;

create policy homepage_banners_public_read on public.homepage_banners for select to anon, authenticated
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
         or (select public.is_staff()));
create policy homepage_banners_admin on public.homepage_banners for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy homepage_sections_public_read on public.homepage_sections for select to anon, authenticated using (true);
create policy homepage_sections_admin on public.homepage_sections for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Orders: customers read their own; nobody writes directly.
create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
revoke insert, update, delete on public.orders from anon, authenticated;

create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
revoke insert, update, delete on public.order_items from anon, authenticated;

create policy order_status_history_select on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
revoke insert, update, delete on public.order_status_history from anon, authenticated;

-- Payments/refunds: owners can read status of their own; staff read all.
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
revoke insert, update, delete on public.payments from anon, authenticated;

create policy refunds_select on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
revoke insert, update, delete on public.refunds from anon, authenticated;

create policy payment_webhook_events_staff_read on public.payment_webhook_events for select to authenticated
  using ((select public.is_admin()));
revoke insert, update, delete on public.payment_webhook_events from anon, authenticated;

-- Wishlist ------------------------------------------------------------------
create policy wishlist_own on public.wishlist_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Reviews: public sees approved; authors see their own; staff moderate.
create policy reviews_public_read on public.product_reviews for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_staff()));
create policy reviews_insert_own on public.product_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy reviews_delete_own on public.product_reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy reviews_staff_update on public.product_reviews for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
revoke insert on public.product_reviews from anon, authenticated;
grant insert (product_id, user_id, author_name, rating, title, body) on public.product_reviews to authenticated;
revoke update on public.product_reviews from anon, authenticated;
grant update (status, moderation_note) on public.product_reviews to authenticated;

-- Newsletter: written by the server route; admins can read/manage.
create policy newsletter_admin on public.newsletter_subscribers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Support requests: anyone may submit; owners see their own; staff manage.
create policy support_insert on public.support_requests for insert to anon, authenticated
  with check (status = 'open' and (user_id is null or user_id = (select auth.uid())));
create policy support_select on public.support_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy support_staff_update on public.support_requests for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Shipments: owners read; staff manage.
create policy shipments_select on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
create policy shipments_staff_write on public.shipments for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy shipment_events_select on public.shipment_events for select to authenticated
  using (exists (select 1 from public.shipments s join public.orders o on o.id = s.order_id
                 where s.id = shipment_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
create policy shipment_events_staff_insert on public.shipment_events for insert to authenticated
  with check ((select public.is_staff()) and source = 'manual' and actor_id = (select auth.uid()));

-- Audit logs: append by staff (as themselves); read by admins.
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using ((select public.is_admin()));
create policy audit_logs_staff_insert on public.audit_logs for insert to authenticated
  with check ((select public.is_staff()) and actor_id = (select auth.uid()));
revoke update, delete on public.audit_logs from anon, authenticated;

-- Settings & content: public read, admin write.
create policy store_settings_public_read on public.store_settings for select to anon, authenticated using (true);
create policy store_settings_admin on public.store_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy content_pages_public_read on public.content_pages for select to anon, authenticated using (true);
create policy content_pages_admin on public.content_pages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
