-- Homepage "brand showcase" section (portfolio artwork), orderable and
-- hideable from Admin -> Homepage like the other sections.
alter table public.homepage_sections drop constraint if exists homepage_sections_key_check;
alter table public.homepage_sections
  add constraint homepage_sections_key_check
  check (key in ('category_tiles', 'bestsellers', 'most_viewed', 'latest', 'promo_banners', 'featured', 'brand_showcase'));

insert into public.homepage_sections (key, title, sort_order, item_limit)
values ('brand_showcase', 'The Artisanal Portfolio', 25, 2)
on conflict (key) do nothing;
