-- Storefront listing view and popularity score.

alter table public.products add column popularity_score integer not null default 0;
create index products_popularity_idx on public.products (popularity_score desc);

-- popularity_score is maintained by refresh_product_popularity(), not by clients.
revoke update on public.products from anon, authenticated;
grant update (
  name, slug, brand, short_description, description, ingredients, storage_instructions, allergen_info,
  shelf_life, country_of_origin, manufacturer_info, fssai_license, status, is_featured, featured_rank,
  is_bestseller, bestseller_rank, published_at, seo_title, seo_description, og_image_url
) on public.products to authenticated;

-- One row per product with the aggregates the storefront needs for listing,
-- filtering and sorting. security_invoker makes the underlying RLS apply, so
-- anonymous visitors only see published products.
create view public.product_listing with (security_invoker = true) as
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
  where pv.product_id = p.id and pv.is_active
) v on true
left join lateral (
  select array_agg(cat.slug order by cat.sort_order) as category_slugs, array_agg(cat.id) as category_ids
    from public.product_categories pc
    join public.categories cat on cat.id = pc.category_id
   where pc.product_id = p.id
) c on true;

grant select on public.product_listing to anon, authenticated, service_role;

-- Popularity = distinct daily views (30d) + 5 x units sold in confirmed orders (30d).
create or replace function public.refresh_product_popularity()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with views as (
    select product_id, count(*)::integer as v
      from public.product_view_events
     where viewed_on >= current_date - 30
     group by product_id
  ), sales as (
    select oi.product_id, sum(oi.quantity)::integer as u
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where o.status in ('confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered')
       and o.created_at >= now() - interval '30 days'
     group by oi.product_id
  )
  update public.products p
     set popularity_score = coalesce(vw.v, 0) + 5 * coalesce(s.u, 0)
    from public.products p2
    left join views vw on vw.product_id = p2.id
    left join sales s on s.product_id = p2.id
   where p.id = p2.id
     and p.popularity_score is distinct from coalesce(vw.v, 0) + 5 * coalesce(s.u, 0);
  get diagnostics n = row_count;
  -- Old view events are not needed beyond the popularity window.
  delete from public.product_view_events where viewed_on < current_date - 90;
  return n;
end;
$$;

revoke execute on function public.refresh_product_popularity() from public, anon, authenticated;
grant execute on function public.refresh_product_popularity() to service_role;
