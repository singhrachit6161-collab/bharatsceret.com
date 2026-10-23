-- Nested catalogue (Shop > Dry Fruits > Almonds, Regions > Kashmir, ...).
--
-- 1. product_listing.category_slugs / category_ids now include every ANCESTOR
--    of a product's categories, so a parent collection page (e.g. dry-fruits)
--    lists everything in its sub-collections.
-- 2. Homepage gains a 'regions' section key.
-- 3. Guard against cycles in the category tree.

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
  where pv.product_id = p.id and pv.is_active
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

alter table public.homepage_sections drop constraint if exists homepage_sections_key_check;
alter table public.homepage_sections
  add constraint homepage_sections_key_check
  check (key in ('category_tiles', 'bestsellers', 'most_viewed', 'latest', 'promo_banners', 'featured', 'brand_showcase', 'regions'));

insert into public.homepage_sections (key, title, sort_order, item_limit)
values ('regions', 'Explore by region', 27, 12)
on conflict (key) do nothing;

-- A category may not become its own ancestor.
create or replace function public.categories_prevent_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if exists (
    with recursive up as (
      select id, parent_id, 0 as depth from public.categories where id = new.parent_id
      union all
      select c.id, c.parent_id, up.depth + 1 from public.categories c join up on c.id = up.parent_id where up.depth < 16
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'CATEGORY_CYCLE';
  end if;
  return new;
end;
$$;

create trigger categories_prevent_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_prevent_cycle();
