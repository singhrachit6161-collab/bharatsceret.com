-- Admin reporting helpers (staff only).
--
-- Reporting rules:
--   * Sales = total_paise - refunded_paise of orders whose payment is
--     confirmed: online 'paid' / 'partially_refunded' or COD 'cod_collected'.
--   * Orders count excludes unpaid online orders (pending_payment / payment_failed).
--   * Dates are filtered on orders.created_at.

create or replace function public.admin_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'orders_count', count(*) filter (where status not in ('pending_payment', 'payment_failed')),
    'paid_orders', count(*) filter (where payment_status in ('paid', 'partially_refunded', 'cod_collected')),
    'sales_paise', coalesce(sum(total_paise - refunded_paise) filter (where payment_status in ('paid', 'partially_refunded', 'cod_collected')), 0),
    'cod_outstanding_paise', coalesce(sum(total_paise) filter (where payment_status = 'cod_pending' and status <> 'cancelled'), 0),
    'refunded_paise', coalesce(sum(refunded_paise), 0)
  ) into result
  from public.orders
  where created_at >= p_from and created_at < p_to;

  result := result || jsonb_build_object(
    'pending_payment', (select count(*) from public.orders where status = 'pending_payment'),
    'pending_fulfilment', (select count(*) from public.orders where status in ('confirmed', 'processing', 'packed')),
    'on_hold', (select count(*) from public.orders where status = 'on_hold'),
    'refund_required', (select count(*) from public.orders
                         where status = 'cancelled' and payment_status in ('paid', 'partially_refunded')),
    'low_stock', coalesce((
      select jsonb_agg(row_to_json(x)) from (
        select v.id as variant_id, v.sku, v.label, p.name as product_name, p.id as product_id,
               i.on_hand, i.reserved, i.on_hand - i.reserved as available, i.low_stock_threshold
          from public.inventory i
          join public.product_variants v on v.id = i.variant_id and v.is_active
          join public.products p on p.id = v.product_id and p.status = 'active'
         where i.on_hand - i.reserved <= i.low_stock_threshold
         order by i.on_hand - i.reserved, p.name
         limit 25
      ) x), '[]'::jsonb),
    'bestsellers', coalesce((
      select jsonb_agg(row_to_json(b)) from (
        select oi.product_id, max(oi.product_name) as product_name, sum(oi.quantity)::integer as units,
               sum(oi.line_total_paise)::bigint as revenue_paise
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
         where o.created_at >= p_from and o.created_at < p_to
           and o.status in ('confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered')
         group by oi.product_id
         order by units desc
         limit 10
      ) b), '[]'::jsonb)
  );
  return result;
end;
$$;

revoke execute on function public.admin_dashboard(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_dashboard(timestamptz, timestamptz) to authenticated, service_role;

-- Customer overview for staff: profile + order aggregates (no auth secrets).
create or replace function public.admin_customers(p_search text, p_limit integer, p_offset integer)
returns table (
  user_id uuid, full_name text, phone text, email text, joined_at timestamptz,
  order_count bigint, paid_total_paise bigint, last_order_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  return query
  with base as (
    select pr.id, pr.full_name, pr.phone, u.email::text as email, pr.created_at
      from public.profiles pr
      join auth.users u on u.id = pr.id
     where p_search is null or p_search = ''
        or pr.full_name ilike '%' || p_search || '%'
        or pr.phone ilike '%' || p_search || '%'
        or u.email ilike '%' || p_search || '%'
  )
  select b.id, b.full_name, b.phone, b.email, b.created_at,
         count(o.id), coalesce(sum(o.total_paise - o.refunded_paise) filter (where o.payment_status in ('paid', 'partially_refunded', 'cod_collected')), 0)::bigint,
         max(o.created_at), count(*) over ()
    from base b
    left join public.orders o on o.user_id = b.id
   group by b.id, b.full_name, b.phone, b.email, b.created_at
   order by max(o.created_at) desc nulls last, b.created_at desc
   limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
end;
$$;

revoke execute on function public.admin_customers(text, integer, integer) from public, anon;
grant execute on function public.admin_customers(text, integer, integer) to authenticated, service_role;
