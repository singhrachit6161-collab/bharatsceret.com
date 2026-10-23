-- Build Your Own Hamper.
--
-- * A hamper box is an ordinary product variant with hamper_capacity set
--   (stock, price and inventory work as for any variant). Box variants are
--   hidden from normal listings and can only be bought inside a hamper.
-- * Cart/checkout send the aggregated variant quantities as p_items (so stock
--   reservation and pricing are unchanged) plus p_bundles describing each
--   hamper; place_order validates capacity and that every bundle unit is
--   covered, and snapshots each hamper into order_bundles for packing.

alter table public.product_variants
  add column hamper_capacity smallint check (hamper_capacity is null or hamper_capacity between 1 and 24);

create table public.order_bundles (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position integer not null,
  box_variant_id uuid references public.product_variants (id) on delete set null,
  box_name text not null,
  box_label text not null,
  capacity smallint not null,
  recipient_name text check (char_length(recipient_name) <= 80),
  gift_message text check (char_length(gift_message) <= 300),
  contents jsonb not null,
  created_at timestamptz not null default now(),
  unique (order_id, position)
);
create index order_bundles_order_idx on public.order_bundles (order_id);

alter table public.order_bundles enable row level security;
create policy order_bundles_select on public.order_bundles for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = (select auth.uid()) or (select public.is_staff()))));
revoke insert, update, delete on public.order_bundles from anon, authenticated;

-- Boxes are not sold on their own: exclude them from storefront listings.
create or replace view public.product_listing with (security_invoker = true) as
select
  p.id,
  p.name,
  p.slug,
  p.short_description,
  p.brand,
  p.status,
  p.published_at,
  p.created_at,
  p.is_featured,
  p.featured_rank,
  p.is_bestseller,
  p.bestseller_rank,
  p.rating_avg,
  p.review_count,
  p.popularity_score,
  img.url as image_url,
  img.alt as image_alt,
  v.variant_count,
  v.min_price_paise,
  v.max_price_paise,
  v.in_stock,
  v.pack_labels,
  v.default_variant_id,
  v.default_variant_label,
  v.default_price_paise,
  v.default_compare_at_paise,
  v.default_available,
  v.default_max_per_order,
  coalesce(c.category_slugs, '{}'::text[]) as category_slugs,
  coalesce(c.category_ids, '{}'::uuid[]) as category_ids
from public.products p
left join lateral (
  select pi.url, pi.alt
    from public.product_images pi
   where pi.product_id = p.id
   order by pi.sort_order, pi.created_at
   limit 1
) img on true
left join lateral (
  select
    count(*)::integer as variant_count,
    min(pv.price_paise) as min_price_paise,
    max(pv.price_paise) as max_price_paise,
    coalesce(bool_or(coalesce(i.on_hand - i.reserved, 0) > 0), false) as in_stock,
    array_agg(pv.label order by pv.sort_order, pv.price_paise) as pack_labels,
    (array_agg(pv.id order by (coalesce(i.on_hand - i.reserved, 0) > 0) desc, pv.sort_order, pv.price_paise))[1] as default_variant_id,
    (array_agg(pv.label order by (coalesce(i.on_hand - i.reserved, 0) > 0) desc, pv.sort_order, pv.price_paise))[1] as default_variant_label,
    (array_agg(pv.price_paise order by (coalesce(i.on_hand - i.reserved, 0) > 0) desc, pv.sort_order, pv.price_paise))[1] as default_price_paise,
    (array_agg(pv.compare_at_paise order by (coalesce(i.on_hand - i.reserved, 0) > 0) desc, pv.sort_order, pv.price_paise))[1] as default_compare_at_paise,
    (array_agg(greatest(coalesce(i.on_hand - i.reserved, 0), 0) order by (coalesce(i.on_hand - i.reserved, 0) > 0) desc, pv.sort_order, pv.price_paise))[1] as default_available,
    (array_agg(pv.max_per_order order by (coalesce(i.on_hand - i.reserved, 0) > 0) desc, pv.sort_order, pv.price_paise))[1] as default_max_per_order
  from public.product_variants pv
  left join public.inventory i on i.variant_id = pv.id
  where pv.product_id = p.id and pv.is_active and pv.hamper_capacity is null
) v on true
left join lateral (
  with recursive cats as (
    select cat.id, cat.slug, cat.parent_id, 0 as depth
      from public.product_categories pc
      join public.categories cat on cat.id = pc.category_id
     where pc.product_id = p.id
    union
    select parent.id, parent.slug, parent.parent_id, cats.depth + 1
      from public.categories parent
      join cats on parent.id = cats.parent_id
     where cats.depth < 8
  )
  select array_agg(distinct cats.slug) as category_slugs, array_agg(distinct cats.id) as category_ids
    from cats
) c on true;

grant select on public.product_listing to anon, authenticated, service_role;

drop function public.place_order(uuid, text, public.payment_method, jsonb, bigint, bigint, bigint, bigint, bigint, uuid, jsonb, text, text, text, integer);

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
  p_reservation_minutes integer default 30,
  p_bundles jsonb default '[]'::jsonb
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
  v_bundle record;
  v_capacity integer;
  v_units integer;
  v_distinct integer;
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

  -- Hamper bundles (Build Your Own Hamper). Each bundle is one box variant
  -- (hamper_capacity not null) plus contents. Every unit a bundle needs must
  -- be covered by p_items, and box variants may only be bought inside a hamper.
  if p_bundles is null or jsonb_typeof(p_bundles) <> 'array' or jsonb_array_length(p_bundles) > 5 then
    raise exception 'INVALID_BUNDLE';
  end if;
  for v_bundle in select value as b from jsonb_array_elements(p_bundles)
  loop
    select v.hamper_capacity into v_capacity
      from public.product_variants v
     where v.id = (v_bundle.b ->> 'box_variant_id')::uuid and v.hamper_capacity is not null;
    if v_capacity is null or jsonb_typeof(v_bundle.b -> 'contents') <> 'array' then
      raise exception 'INVALID_BUNDLE';
    end if;
    select coalesce(sum((c ->> 'quantity')::integer), 0), count(*), count(distinct c ->> 'variant_id')
      into v_units, v_count, v_distinct
      from jsonb_array_elements(v_bundle.b -> 'contents') c;
    if v_units < 1 or v_count <> v_distinct
       or exists (select 1 from jsonb_array_elements(v_bundle.b -> 'contents') c where (c ->> 'quantity')::integer < 1) then
      raise exception 'INVALID_BUNDLE';
    end if;
    if v_units > v_capacity then
      raise exception 'BUNDLE_OVER_CAPACITY';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_bundle.b -> 'contents') c
        join public.product_variants cv on cv.id = (c ->> 'variant_id')::uuid
       where cv.hamper_capacity is not null
    ) then
      raise exception 'INVALID_BUNDLE';
    end if;
    if char_length(coalesce(v_bundle.b ->> 'gift_message', '')) > 300
       or char_length(coalesce(v_bundle.b ->> 'recipient_name', '')) > 80 then
      raise exception 'INVALID_BUNDLE';
    end if;
  end loop;

  if exists (
    with demand as (
      select (b ->> 'box_variant_id')::uuid as variant_id, 1 as qty from jsonb_array_elements(p_bundles) b
      union all
      select (c ->> 'variant_id')::uuid, (c ->> 'quantity')::integer
        from jsonb_array_elements(p_bundles) b, jsonb_array_elements(b -> 'contents') c
    ), d as (select variant_id, sum(qty) as q from demand group by variant_id),
    items as (select (e ->> 'variant_id')::uuid as variant_id, (e ->> 'quantity')::integer as q from jsonb_array_elements(p_items) e)
    select 1 from d left join items i using (variant_id) where i.q is null or d.q > i.q
  ) then
    raise exception 'INVALID_BUNDLE';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) e
      join public.product_variants v on v.id = (e ->> 'variant_id')::uuid and v.hamper_capacity is not null
     where (e ->> 'quantity')::integer <> (
       select count(*) from jsonb_array_elements(p_bundles) b where (b ->> 'box_variant_id')::uuid = v.id
     )
  ) then
    raise exception 'BOX_WITHOUT_HAMPER';
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

  v_order_number := 'BS' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-'
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

  insert into public.order_bundles (order_id, position, box_variant_id, box_name, box_label, capacity, recipient_name, gift_message, contents)
  select v_order_id, t.ord, v.id, p.name, v.label, v.hamper_capacity,
         nullif(trim(t.b ->> 'recipient_name'), ''), nullif(trim(t.b ->> 'gift_message'), ''),
         (select jsonb_agg(jsonb_build_object(
                   'variant_id', cv.id, 'product_name', cp.name, 'variant_label', cv.label, 'sku', cv.sku,
                   'quantity', (c ->> 'quantity')::integer, 'unit_price_paise', cv.price_paise) order by cp.name)
            from jsonb_array_elements(t.b -> 'contents') c
            join public.product_variants cv on cv.id = (c ->> 'variant_id')::uuid
            join public.products cp on cp.id = cv.product_id)
    from jsonb_array_elements(p_bundles) with ordinality as t(b, ord)
    join public.product_variants v on v.id = (t.b ->> 'box_variant_id')::uuid
    join public.products p on p.id = v.product_id;

  perform public._record_status(v_order_id, null, v_status, 'Order placed', p_user_id);

  return query select v_order_id, v_order_number, true;
end;
$$;

revoke execute on function public.place_order(uuid, text, public.payment_method, jsonb, bigint, bigint, bigint, bigint, bigint, uuid, jsonb, text, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(uuid, text, public.payment_method, jsonb, bigint, bigint, bigint, bigint, bigint, uuid, jsonb, text, text, text, integer, jsonb) to service_role;
