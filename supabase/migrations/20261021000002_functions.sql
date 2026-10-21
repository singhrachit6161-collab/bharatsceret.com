-- Business functions: roles, order placement, stock reservation, payment
-- confirmation, cancellation, refunds and inventory adjustments.
--
-- Stock strategy (documented in docs/INVENTORY.md):
--   * Online (Razorpay) orders RESERVE stock when the order is created
--     (inventory.reserved += qty) for a limited window (default 30 min).
--   * When payment is verified as captured, the reservation is COMMITTED
--     (on_hand -= qty, reserved -= qty) exactly once.
--   * When the window expires without a captured payment, the reservation
--     is RELEASED (reserved -= qty) exactly once.
--   * COD orders commit stock immediately at placement.
--   * Cancelling a confirmed order restores committed stock exactly once.
-- All transitions lock the order row first, then inventory rows in
-- variant_id order, to avoid deadlocks.

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.has_any_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = any (roles)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['owner', 'admin', 'operations']::public.app_role[]);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['owner', 'admin']::public.app_role[]);
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role' or current_user = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- Profile bootstrap. Only the display name is copied from user metadata;
-- roles are NEVER derived from client-editable metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public._record_status(
  p_order_id uuid, p_from public.order_status, p_to public.order_status, p_note text, p_actor uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_status_history (order_id, from_status, to_status, note, actor_id)
  values (p_order_id, p_from, p_to, p_note, p_actor);
$$;

-- Release every ACTIVE reservation of an order (idempotent).
create or replace function public._release_reservations(p_order_id uuid, p_actor uuid, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id, variant_id, quantity from public.inventory_reservations
    where order_id = p_order_id and status = 'active'
    order by variant_id
    for update
  loop
    update public.inventory set reserved = reserved - r.quantity where variant_id = r.variant_id;
    update public.inventory_reservations set status = 'released' where id = r.id;
    insert into public.inventory_movements (variant_id, reason, delta_reserved, order_id, actor_id, note)
    values (r.variant_id, 'reservation_release', -r.quantity, p_order_id, p_actor, p_note);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Reverse the coupon redemption of an order (idempotent).
create or replace function public._reverse_coupon(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon uuid;
begin
  update public.coupon_redemptions
     set reversed_at = now()
   where order_id = p_order_id and reversed_at is null
  returning coupon_id into v_coupon;
  if v_coupon is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_coupon;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order: called ONLY by trusted server code (service role) after the
-- server has recomputed prices. The function re-validates prices, stock,
-- coupon limits and arithmetic, and is idempotent per (user, key).
-- p_items: [{"variant_id": uuid, "quantity": int, "unit_price_paise": int}]
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_user_id uuid,
  p_idempotency_key text,
  p_payment_method public.payment_method,
  p_items jsonb,
  p_subtotal_paise bigint,
  p_discount_paise bigint,
  p_shipping_paise bigint,
  p_cod_fee_paise bigint,
  p_total_paise bigint,
  p_coupon_id uuid,
  p_shipping_address jsonb,
  p_contact_email text,
  p_contact_phone text,
  p_customer_note text,
  p_reservation_minutes integer default 30
)
returns table (order_id uuid, order_number text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing record;
  v_order_id uuid;
  v_order_number text;
  v_item record;
  v_subtotal bigint := 0;
  v_coupon record;
  v_coupon_code text;
  v_user_redemptions integer;
  v_status public.order_status;
  v_pay_status public.order_payment_status;
  v_expires timestamptz;
  v_count integer;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  select o.id, o.order_number into v_existing
    from public.orders o
   where o.user_id = p_user_id and o.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.order_number, false;
    return;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  select count(*), count(distinct (e ->> 'variant_id')) into v_count, v_subtotal
    from jsonb_array_elements(p_items) e;
  if v_count <> v_subtotal then
    raise exception 'DUPLICATE_ITEMS';
  end if;
  v_subtotal := 0;

  -- Validate every line against the live catalog.
  for v_item in
    select (e ->> 'variant_id')::uuid as variant_id,
           (e ->> 'quantity')::integer as quantity,
           (e ->> 'unit_price_paise')::bigint as unit_price_paise,
           v.price_paise, v.max_per_order, v.is_active as variant_active,
           p.status as product_status, p.published_at
      from jsonb_array_elements(p_items) e
      left join public.product_variants v on v.id = (e ->> 'variant_id')::uuid
      left join public.products p on p.id = v.product_id
     order by 1
  loop
    if v_item.price_paise is null or not v_item.variant_active
       or v_item.product_status <> 'active'
       or (v_item.published_at is not null and v_item.published_at > now()) then
      raise exception 'VARIANT_UNAVAILABLE' using detail = v_item.variant_id::text;
    end if;
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > v_item.max_per_order then
      raise exception 'INVALID_QUANTITY' using detail = v_item.variant_id::text;
    end if;
    if v_item.unit_price_paise <> v_item.price_paise then
      raise exception 'PRICE_CHANGED' using detail = v_item.variant_id::text;
    end if;
    v_subtotal := v_subtotal + v_item.price_paise * v_item.quantity;
  end loop;

  if v_subtotal <> p_subtotal_paise then
    raise exception 'TOTAL_MISMATCH';
  end if;
  if p_discount_paise < 0 or p_discount_paise > p_subtotal_paise or p_shipping_paise < 0 or p_cod_fee_paise < 0
     or p_total_paise <> p_subtotal_paise - p_discount_paise + p_shipping_paise + p_cod_fee_paise then
    raise exception 'TOTAL_MISMATCH';
  end if;
  if p_payment_method = 'razorpay' and p_total_paise < 100 then
    raise exception 'TOTAL_TOO_LOW';
  end if;

  -- Coupon limits are checked under a row lock so concurrent orders cannot
  -- exceed usage limits.
  if p_coupon_id is not null then
    select * into v_coupon from public.coupons c where c.id = p_coupon_id for update;
    if not found or not v_coupon.is_active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at <= now())
       or v_coupon.min_order_paise > p_subtotal_paise
       or (v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit) then
      raise exception 'COUPON_INVALID';
    end if;
    if v_coupon.per_customer_limit is not null then
      select count(*) into v_user_redemptions
        from public.coupon_redemptions cr
       where cr.coupon_id = p_coupon_id and cr.user_id = p_user_id and cr.reversed_at is null;
      if v_user_redemptions >= v_coupon.per_customer_limit then
        raise exception 'COUPON_LIMIT_REACHED';
      end if;
    end if;
    if p_discount_paise = 0 then
      raise exception 'COUPON_INVALID';
    end if;
    v_coupon_code := v_coupon.code::text;
  elsif p_discount_paise <> 0 then
    raise exception 'TOTAL_MISMATCH';
  end if;

  if p_payment_method = 'razorpay' then
    v_status := 'pending_payment';
    v_pay_status := 'pending';
    v_expires := now() + make_interval(mins => greatest(5, least(p_reservation_minutes, 120)));
  else
    v_status := 'confirmed';
    v_pay_status := 'cod_pending';
    v_expires := null;
  end if;

  v_order_number := 'SV' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-'
                    || nextval('public.order_number_seq')::text;

  begin
    insert into public.orders (
      order_number, user_id, status, payment_method, payment_status, subtotal_paise, discount_paise,
      shipping_paise, cod_fee_paise, total_paise, coupon_id, coupon_code, shipping_address,
      contact_email, contact_phone, customer_note, idempotency_key, reservation_expires_at
    ) values (
      v_order_number, p_user_id, v_status, p_payment_method, v_pay_status, p_subtotal_paise, p_discount_paise,
      p_shipping_paise, p_cod_fee_paise, p_total_paise, p_coupon_id, v_coupon_code,
      p_shipping_address, p_contact_email, p_contact_phone, nullif(trim(p_customer_note), ''),
      p_idempotency_key, v_expires
    )
    returning id into v_order_id;
  exception when unique_violation then
    -- A concurrent request with the same idempotency key won the race.
    select o.id, o.order_number into v_existing
      from public.orders o
     where o.user_id = p_user_id and o.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.order_number, false;
      return;
    end if;
    raise;
  end;

  -- Snapshot order lines.
  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_label, sku, image_url,
    unit_price_paise, quantity, line_total_paise
  )
  select v_order_id, p.id, v.id, p.name, v.label, v.sku,
         (select pi.url from public.product_images pi where pi.product_id = p.id order by pi.sort_order, pi.created_at limit 1),
         v.price_paise, (e ->> 'quantity')::integer, v.price_paise * (e ->> 'quantity')::integer
    from jsonb_array_elements(p_items) e
    join public.product_variants v on v.id = (e ->> 'variant_id')::uuid
    join public.products p on p.id = v.product_id;

  -- Reserve (online) or commit (COD) stock. The conditional UPDATE takes a
  -- row lock and re-checks availability, so two buyers cannot both claim the
  -- last unit.
  for v_item in
    select (e ->> 'variant_id')::uuid as variant_id, (e ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e
     order by 1
  loop
    if p_payment_method = 'razorpay' then
      update public.inventory i
         set reserved = i.reserved + v_item.quantity
       where i.variant_id = v_item.variant_id and i.on_hand - i.reserved >= v_item.quantity;
    else
      update public.inventory i
         set on_hand = i.on_hand - v_item.quantity
       where i.variant_id = v_item.variant_id and i.on_hand - i.reserved >= v_item.quantity;
    end if;
    if not found then
      raise exception 'OUT_OF_STOCK' using detail = v_item.variant_id::text;
    end if;

    insert into public.inventory_reservations (order_id, variant_id, quantity, status, expires_at)
    values (v_order_id, v_item.variant_id, v_item.quantity,
            case when p_payment_method = 'razorpay' then 'active' else 'committed' end::public.reservation_status,
            v_expires);

    insert into public.inventory_movements (variant_id, reason, delta_on_hand, delta_reserved, order_id, actor_id)
    values (
      v_item.variant_id,
      case when p_payment_method = 'razorpay' then 'reservation' else 'sale' end::public.movement_reason,
      case when p_payment_method = 'razorpay' then 0 else -v_item.quantity end,
      case when p_payment_method = 'razorpay' then v_item.quantity else 0 end,
      v_order_id, p_user_id
    );
  end loop;

  if p_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, user_id, discount_paise)
    values (p_coupon_id, v_order_id, p_user_id, p_discount_paise);
    update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
  end if;

  perform public._record_status(v_order_id, null, v_status, 'Order placed', p_user_id);

  return query select v_order_id, v_order_number, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Register the Razorpay order created for a DB order (service role).
-- ---------------------------------------------------------------------------
create or replace function public.register_payment_attempt(
  p_order_id uuid, p_provider_order_id text, p_amount_paise bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;
  if v_order.total_paise <> p_amount_paise then
    raise exception 'AMOUNT_MISMATCH';
  end if;
  insert into public.payments (order_id, provider_order_id, amount_paise)
  values (p_order_id, p_provider_order_id, p_amount_paise)
  on conflict (provider_order_id) do update set updated_at = now()
  returning id into v_payment_id;
  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_online_payment: called by trusted server code AFTER the Razorpay
-- signature is verified and the payment is confirmed captured via the API or
-- a verified webhook. Idempotent: duplicate callbacks/webhooks are no-ops.
-- Returns one of: confirmed | already_confirmed | late_confirmed | on_hold | duplicate_payment
-- ---------------------------------------------------------------------------
create or replace function public.confirm_online_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_paise bigint,
  p_method text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment record;
  v_order record;
  v_item record;
  v_ok boolean := true;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  if p_amount_paise <> v_order.total_paise or p_amount_paise <> v_payment.amount_paise then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  if v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    if v_payment.provider_payment_id = p_provider_payment_id and v_payment.status in ('captured', 'refunded', 'partially_refunded') then
      return 'already_confirmed';
    end if;
    -- A second, different captured payment for an already-paid order.
    perform public._record_status(v_order.id, v_order.status, v_order.status,
      'Additional captured payment ' || p_provider_payment_id || ' received; refund required', null);
    insert into public.audit_logs (action, entity_type, entity_id, details)
    values ('payment.duplicate_capture', 'order', v_order.id::text,
            jsonb_build_object('provider_payment_id', p_provider_payment_id, 'amount_paise', p_amount_paise));
    return 'duplicate_payment';
  end if;

  update public.payments
     set status = 'captured', provider_payment_id = p_provider_payment_id, method = p_method,
         error_code = null, error_description = null
   where id = v_payment.id;

  if v_order.status = 'pending_payment' then
    for v_item in
      select id, variant_id, quantity from public.inventory_reservations
       where order_id = v_order.id and status = 'active'
       order by variant_id
       for update
    loop
      update public.inventory
         set on_hand = on_hand - v_item.quantity, reserved = reserved - v_item.quantity
       where variant_id = v_item.variant_id;
      update public.inventory_reservations set status = 'committed' where id = v_item.id;
      insert into public.inventory_movements (variant_id, reason, delta_on_hand, delta_reserved, order_id, note)
      values (v_item.variant_id, 'sale', -v_item.quantity, -v_item.quantity, v_order.id, 'Payment captured');
    end loop;

    update public.orders
       set status = 'confirmed', payment_status = 'paid', paid_at = now(), reservation_expires_at = null
     where id = v_order.id;
    perform public._record_status(v_order.id, 'pending_payment', 'confirmed', 'Payment captured', null);
    return 'confirmed';
  end if;

  -- Payment arrived after the reservation expired (order is payment_failed)
  -- or after cancellation. For expired orders, try to allocate stock again,
  -- all-or-nothing; cancelled orders are never revived automatically.
  v_ok := v_order.status = 'payment_failed';
  if v_ok then
  begin
    for v_item in
      select variant_id, quantity from public.inventory_reservations
       where order_id = v_order.id and status = 'released'
       order by variant_id
    loop
      update public.inventory
         set on_hand = on_hand - v_item.quantity
       where variant_id = v_item.variant_id and on_hand - reserved >= v_item.quantity;
      if not found then
        raise exception 'LATE_ALLOCATION_FAILED';
      end if;
      update public.inventory_reservations set status = 'committed'
       where order_id = v_order.id and variant_id = v_item.variant_id;
      insert into public.inventory_movements (variant_id, reason, delta_on_hand, order_id, note)
      values (v_item.variant_id, 'sale', -v_item.quantity, v_order.id, 'Late payment allocation');
    end loop;
  exception when others then
    v_ok := false;
  end;
  end if;

  if v_ok then
    update public.orders
       set status = 'confirmed', payment_status = 'paid', paid_at = now(), reservation_expires_at = null,
           stock_restored_at = null
     where id = v_order.id;
    -- Re-apply the coupon redemption that was reversed on expiry.
    update public.coupon_redemptions set reversed_at = null where order_id = v_order.id and reversed_at is not null;
    if found then
      update public.coupons set used_count = used_count + 1 where id = v_order.coupon_id;
    end if;
    perform public._record_status(v_order.id, v_order.status, 'confirmed', 'Late payment captured; stock re-allocated', null);
    return 'late_confirmed';
  end if;

  -- Could not allocate stock (or order was cancelled): keep money, flag for refund.
  update public.orders set status = 'on_hold', payment_status = 'paid', paid_at = now() where id = v_order.id;
  perform public._record_status(v_order.id, v_order.status, 'on_hold',
    'Payment captured after reservation expired or cancellation; refund or manual fulfilment required', null);
  return 'on_hold';
end;
$$;

-- Record a failed attempt. The order stays payable until its reservation
-- window expires, so the customer can retry without creating a new order.
create or replace function public.record_payment_failure(
  p_provider_order_id text, p_provider_payment_id text, p_error_code text, p_error_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments
     set status = 'failed',
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         error_code = left(p_error_code, 100),
         error_description = left(p_error_description, 500)
   where provider_order_id = p_provider_order_id
     and status in ('created', 'failed');
end;
$$;

-- ---------------------------------------------------------------------------
-- Expire unpaid orders and release their reservations. Safe to run often
-- (cron / scheduled job). Orders with an authorized-but-uncaptured payment are
-- skipped so a capture in flight is not raced.
-- ---------------------------------------------------------------------------
create or replace function public.expire_pending_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  n integer := 0;
begin
  for v_order in
    select o.id from public.orders o
     where o.status = 'pending_payment'
       and o.reservation_expires_at < now()
       and not exists (
         select 1 from public.payments p
          where p.order_id = o.id and p.status in ('authorized', 'captured')
       )
     order by o.reservation_expires_at
     limit 500
     for update skip locked
  loop
    perform public._release_reservations(v_order.id, null, 'Payment window expired');
    perform public._reverse_coupon(v_order.id);
    update public.orders set status = 'payment_failed', payment_status = 'failed' where id = v_order.id;
    perform public._record_status(v_order.id, 'pending_payment', 'payment_failed', 'Payment window expired', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancellation. Staff can cancel any not-yet-shipped order. Customers can
-- cancel their own unpaid online orders and COD orders that are still
-- 'confirmed'. Committed stock is restored exactly once. Refunds of captured
-- payments are a separate, explicit admin action.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_actor uuid := auth.uid();
  v_staff boolean := public.is_staff() or public.is_service_role();
  v_item record;
begin
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not v_staff then
    if v_actor is null or v_order.user_id <> v_actor then
      raise exception 'FORBIDDEN';
    end if;
    if not (v_order.status = 'pending_payment'
            or (v_order.status = 'confirmed' and v_order.payment_method = 'cod')) then
      raise exception 'NOT_CANCELLABLE';
    end if;
  end if;

  if v_order.status not in ('pending_payment', 'confirmed', 'processing', 'packed', 'on_hold') then
    raise exception 'NOT_CANCELLABLE';
  end if;

  perform public._release_reservations(v_order.id, v_actor, 'Order cancelled');

  if v_order.stock_restored_at is null then
    for v_item in
      select id, variant_id, quantity from public.inventory_reservations
       where order_id = v_order.id and status = 'committed'
       order by variant_id
       for update
    loop
      update public.inventory set on_hand = on_hand + v_item.quantity where variant_id = v_item.variant_id;
      insert into public.inventory_movements (variant_id, reason, delta_on_hand, order_id, actor_id, note)
      values (v_item.variant_id, 'cancellation_restock', v_item.quantity, v_order.id, v_actor, left(p_reason, 300));
    end loop;
    update public.orders set stock_restored_at = now() where id = v_order.id;
  end if;

  perform public._reverse_coupon(v_order.id);

  update public.orders
     set status = 'cancelled', cancelled_at = now(), cancel_reason = left(p_reason, 500),
         payment_status = case when payment_status = 'pending' then 'failed'::public.order_payment_status else payment_status end,
         reservation_expires_at = null
   where id = v_order.id;
  update public.shipments set status = 'cancelled' where order_id = v_order.id and status in ('pending', 'packed');

  perform public._record_status(v_order.id, v_order.status, 'cancelled', left(p_reason, 500), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'order.cancel', 'order', v_order.id::text,
          jsonb_build_object('reason', left(p_reason, 500), 'from_status', v_order.status,
                             'payment_status', v_order.payment_status));

  return case when v_order.payment_status = 'paid' then 'cancelled_refund_required' else 'cancelled' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fulfilment status updates (staff only). Payment state cannot be changed
-- here; cancellation and refunds have dedicated functions.
-- ---------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid, p_to public.order_status, p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_allowed public.order_status[];
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_allowed := case v_order.status
    when 'confirmed' then array['processing', 'packed']::public.order_status[]
    when 'processing' then array['packed']::public.order_status[]
    when 'packed' then array['processing', 'shipped']::public.order_status[]
    when 'shipped' then array['out_for_delivery', 'delivered']::public.order_status[]
    when 'out_for_delivery' then array['delivered', 'shipped']::public.order_status[]
    when 'on_hold' then case when v_order.payment_status = 'paid' and exists (
        select 1 from public.inventory_reservations r where r.order_id = v_order.id and r.status = 'committed'
      ) then array['confirmed']::public.order_status[] else array[]::public.order_status[] end
    else array[]::public.order_status[]
  end;

  if not (p_to = any (v_allowed)) then
    raise exception 'INVALID_TRANSITION' using detail = v_order.status::text || ' -> ' || p_to::text;
  end if;

  update public.orders
     set status = p_to,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end
   where id = v_order.id;
  perform public._record_status(v_order.id, v_order.status, p_to, nullif(trim(p_note), ''), auth.uid());
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'order.status', 'order', v_order.id::text,
          jsonb_build_object('from', v_order.status, 'to', p_to, 'note', p_note));
end;
$$;

-- COD cash confirmed as collected (owner/admin only, audited).
create or replace function public.mark_cod_collected(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_method <> 'cod' or v_order.payment_status <> 'cod_pending'
     or v_order.status <> 'delivered' then
    raise exception 'INVALID_TRANSITION';
  end if;
  update public.orders set payment_status = 'cod_collected', paid_at = now() where id = v_order.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'order.cod_collected', 'order', v_order.id::text, jsonb_build_object('note', p_note));
end;
$$;

-- Return restock (staff): restores committed stock of a delivered/refunded
-- order exactly once. Independent from the financial refund.
create or replace function public.restock_returned_order(p_order_id uuid, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_item record;
  n integer := 0;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  if p_note is null or char_length(trim(p_note)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.stock_restored_at is not null then
    raise exception 'ALREADY_RESTOCKED';
  end if;
  if v_order.status not in ('delivered', 'refunded', 'partially_refunded') then
    raise exception 'INVALID_TRANSITION';
  end if;
  for v_item in
    select variant_id, quantity from public.inventory_reservations
     where order_id = v_order.id and status = 'committed' order by variant_id
  loop
    update public.inventory set on_hand = on_hand + v_item.quantity where variant_id = v_item.variant_id;
    insert into public.inventory_movements (variant_id, reason, delta_on_hand, order_id, actor_id, note)
    values (v_item.variant_id, 'return_restock', v_item.quantity, v_order.id, auth.uid(), left(p_note, 300));
    n := n + 1;
  end loop;
  update public.orders set stock_restored_at = now() where id = v_order.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'order.return_restock', 'order', v_order.id::text, jsonb_build_object('note', p_note));
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inventory adjustments (staff only, reason mandatory, fully logged).
-- ---------------------------------------------------------------------------
create or replace function public.adjust_inventory(p_variant_id uuid, p_delta integer, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand integer;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  if p_note is null or char_length(trim(p_note)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'INVALID_QUANTITY';
  end if;

  insert into public.inventory (variant_id) values (p_variant_id) on conflict (variant_id) do nothing;

  update public.inventory
     set on_hand = on_hand + p_delta
   where variant_id = p_variant_id and on_hand + p_delta >= reserved and on_hand + p_delta >= 0
  returning on_hand into v_on_hand;
  if not found then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into public.inventory_movements (variant_id, reason, delta_on_hand, actor_id, note)
  values (p_variant_id, 'adjustment', p_delta, auth.uid(), left(trim(p_note), 300));
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'inventory.adjust', 'variant', p_variant_id::text,
          jsonb_build_object('delta', p_delta, 'note', p_note, 'on_hand', v_on_hand));
  return v_on_hand;
end;
$$;

-- Create inventory row automatically for every new variant.
create or replace function public.create_inventory_for_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (variant_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger product_variants_create_inventory
  after insert on public.product_variants
  for each row execute function public.create_inventory_for_variant();

-- ---------------------------------------------------------------------------
-- Refunds (service role, after the server has authorised an owner/admin).
-- ---------------------------------------------------------------------------
create or replace function public.create_refund_request(
  p_order_id uuid, p_amount_paise bigint, p_reason text, p_actor uuid, p_idempotency_key text
)
returns table (refund_id uuid, provider_payment_id text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_payment record;
  v_existing record;
  v_outstanding bigint;
  v_id uuid;
begin
  select r.id, p.provider_payment_id as ppid into v_existing
    from public.refunds r join public.payments p on p.id = r.payment_id
   where r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.ppid, false;
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_method <> 'razorpay' or v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'NOT_REFUNDABLE';
  end if;
  select * into v_payment from public.payments
   where order_id = p_order_id and status in ('captured', 'partially_refunded')
   order by updated_at desc limit 1;
  if not found or v_payment.provider_payment_id is null then
    raise exception 'NOT_REFUNDABLE';
  end if;

  select v_order.total_paise - v_order.refunded_paise
         - coalesce(sum(amount_paise) filter (where status = 'pending'), 0)
    into v_outstanding
    from public.refunds where order_id = p_order_id;
  if p_amount_paise <= 0 or p_amount_paise > v_outstanding then
    raise exception 'REFUND_EXCEEDS_BALANCE';
  end if;

  insert into public.refunds (order_id, payment_id, amount_paise, reason, requested_by, idempotency_key)
  values (p_order_id, v_payment.id, p_amount_paise, p_reason, p_actor, p_idempotency_key)
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'refund.request', 'order', p_order_id::text,
          jsonb_build_object('refund_id', v_id, 'amount_paise', p_amount_paise, 'reason', p_reason));
  return query select v_id, v_payment.provider_payment_id, true;
end;
$$;

-- Apply an authoritative refund state from the gateway (API response or a
-- verified webhook). Amounts are applied to the order exactly once.
create or replace function public.sync_refund(
  p_refund_request_id uuid,
  p_provider_payment_id text,
  p_provider_refund_id text,
  p_amount_paise bigint,
  p_status public.refund_status,
  p_failure_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment record;
  v_refund record;
  v_refund_id uuid;
  v_order record;
  v_new_refunded bigint;
begin
  select * into v_payment from public.payments where provider_payment_id = p_provider_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  if p_refund_request_id is not null then
    select id into v_refund_id from public.refunds where id = p_refund_request_id and payment_id = v_payment.id;
  end if;
  if v_refund_id is null and p_provider_refund_id is not null then
    select id into v_refund_id from public.refunds where provider_refund_id = p_provider_refund_id;
  end if;
  if v_refund_id is null then
    if p_provider_refund_id is null then
      raise exception 'REFUND_NOT_FOUND';
    end if;
    -- Refund initiated outside this app (e.g. Razorpay dashboard).
    insert into public.refunds (order_id, payment_id, provider_refund_id, amount_paise, status, reason, idempotency_key)
    values (v_order.id, v_payment.id, p_provider_refund_id, p_amount_paise, 'pending',
            'Recorded from gateway event', 'gateway:' || p_provider_refund_id)
    returning id into v_refund_id;
  end if;
  select * into v_refund from public.refunds where id = v_refund_id for update;

  if v_refund.amount_paise <> p_amount_paise then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  if v_refund.status = 'processed' then
    update public.refunds set provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id) where id = v_refund.id;
    return 'already_processed';
  end if;

  update public.refunds
     set status = p_status,
         provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id),
         failure_reason = case when p_status = 'failed' then left(p_failure_reason, 500) end
   where id = v_refund.id;

  if p_status <> 'processed' then
    return p_status::text;
  end if;

  v_new_refunded := v_order.refunded_paise + v_refund.amount_paise;
  update public.orders
     set refunded_paise = v_new_refunded,
         payment_status = case when v_new_refunded >= total_paise then 'refunded' else 'partially_refunded' end::public.order_payment_status,
         status = case
           when status in ('cancelled', 'on_hold') then case when status = 'on_hold' and v_new_refunded >= total_paise then 'cancelled' else status end
           when v_new_refunded >= total_paise then 'refunded'
           else 'partially_refunded'
         end::public.order_status
   where id = v_order.id;
  update public.payments
     set status = case when v_new_refunded >= v_payment.amount_paise then 'refunded' else 'partially_refunded' end::public.payment_record_status
   where id = v_payment.id;
  perform public._record_status(v_order.id, v_order.status,
    (select status from public.orders where id = v_order.id),
    'Refund of ' || v_refund.amount_paise || ' paise processed', null);
  return 'processed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews: verified-purchase flag and status are derived server-side.
-- ---------------------------------------------------------------------------
create or replace function public.reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not (public.is_staff() or public.is_service_role()) then
      new.status := 'pending';
      new.moderation_note := null;
    end if;
    new.is_verified_purchase := exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
       where o.user_id = new.user_id and oi.product_id = new.product_id and o.status = 'delivered'
    );
  else
    -- Only staff may update reviews (RLS); keep identity/verification immutable.
    new.user_id := old.user_id;
    new.product_id := old.product_id;
    new.is_verified_purchase := old.is_verified_purchase;
  end if;
  return new;
end;
$$;

create trigger product_reviews_before_write
  before insert or update on public.product_reviews
  for each row execute function public.reviews_before_write();

create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set review_count = s.cnt, rating_avg = s.avg
    from (
      select count(*)::integer as cnt, round(avg(rating)::numeric, 2) as avg
        from public.product_reviews where product_id = v_product and status = 'approved'
    ) s
   where p.id = v_product;
  return null;
end;
$$;

create trigger product_reviews_refresh_rating
  after insert or update or delete on public.product_reviews
  for each row execute function public.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Popularity
-- ---------------------------------------------------------------------------
create or replace function public.record_product_view(p_product_id uuid, p_session_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_view_events (product_id, session_hash)
  select p_product_id, p_session_hash
   where exists (select 1 from public.products where id = p_product_id and status = 'active')
  on conflict do nothing;
$$;

create or replace function public.most_viewed_product_ids(p_days integer, p_limit integer)
returns table (product_id uuid, views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.product_id, count(*) as views
    from public.product_view_events e
    join public.products p on p.id = e.product_id and p.status = 'active'
   where e.viewed_on >= current_date - greatest(1, least(p_days, 90))
   group by e.product_id
   order by views desc
   limit greatest(1, least(p_limit, 24));
$$;

create or replace function public.bestselling_product_ids(p_days integer, p_limit integer)
returns table (product_id uuid, units bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select oi.product_id, sum(oi.quantity)::bigint as units
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id and p.status = 'active'
   where o.status in ('confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered')
     and o.created_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
   group by oi.product_id
   order by units desc
   limit greatest(1, least(p_limit, 24));
$$;

-- ---------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE to anon/authenticated by
-- default, so revoke everything and grant explicitly.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;

grant execute on function
  public.has_any_role(public.app_role[]),
  public.is_staff(),
  public.is_admin(),
  public.is_service_role(),
  public.most_viewed_product_ids(integer, integer),
  public.bestselling_product_ids(integer, integer)
to anon, authenticated;

grant execute on function
  public.cancel_order(uuid, text),
  public.update_order_status(uuid, public.order_status, text),
  public.mark_cod_collected(uuid, text),
  public.restock_returned_order(uuid, text),
  public.adjust_inventory(uuid, integer, text)
to authenticated;

grant execute on all functions in schema public to service_role;

-- Trigger functions run as their owner; RLS helper functions above must be
-- callable during policy evaluation.
