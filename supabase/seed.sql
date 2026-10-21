-- Development / staging seed data.
-- * Products, prices and stock below are SAMPLE values so the storefront can be
--   exercised end-to-end. Replace them with your real catalogue before launch.
-- * Images point to labelled placeholder illustrations in /public/placeholders.
-- * Policy pages are TEMPLATES and must be reviewed by the business (and a legal
--   advisor) before going live. No certifications or health claims are made.
-- Safe to re-run: uses ON CONFLICT on natural keys.

-- Store settings --------------------------------------------------------------
insert into public.store_settings (key, value) values
  ('announcement', '{"enabled": true, "message": "The royal treasury of Indian dry fruits \u00b7 Delivered across India", "link_label": "Shop the collection", "link_url": "/shop"}'),
  ('store_contact', '{"brand_name": "Bharat Secrets", "legal_name": "", "email": "support@example.com", "phone": "", "whatsapp": "", "address": "", "hours": "Mon–Sat, 10:00–18:00 IST", "fssai_license": ""}'),
  ('shipping', '{"flat_fee_paise": 6900, "free_shipping_threshold_paise": 99900, "estimated_days_min": 3, "estimated_days_max": 7, "serviceable_pincode_prefixes": []}'),
  ('cod', '{"enabled": true, "fee_paise": 4900, "min_order_paise": 29900, "max_order_paise": 500000}'),
  ('checkout', '{"reservation_minutes": 30}'),
  ('social', '{"instagram": "", "facebook": "", "youtube": "", "x": ""}'),
  ('heritage', '{"enabled": true, "eyebrow": "From Bharat to the world", "title": "India\u2019s finest harvest, presented the royal way", "body": "Bharat Secrets brings together the dry fruits India has treasured for generations \u2014 selected, sorted and packed for homes and gifting tables in India and abroad. [TEMPLATE \u2014 replace with your own sourcing story, and only mention export standards or certifications you actually hold.]", "cta_label": "Our story", "cta_url": "/about", "image_url": "/brand/heritage-peacock-box.webp", "pillars": [{"title": "Thoughtfully sourced", "text": "Selected from India\u2019s celebrated growing regions."}, {"title": "Carefully graded", "text": "Sorted by size and quality before packing."}, {"title": "Gift-ready presentation", "text": "Elegant packs and hampers for every occasion."}]}'),
  ('trust_strip', '[{"icon": "truck", "title": "Shipping across India", "text": "Free shipping on orders above ₹999"}, {"icon": "package", "title": "Carefully packed", "text": "Sealed packs to keep products fresh"}, {"icon": "shield", "title": "Secure payments", "text": "UPI, cards and netbanking via Razorpay"}, {"icon": "headset", "title": "Customer support", "text": "Mon–Sat, 10:00–18:00 IST"}]')
on conflict (key) do nothing;

insert into public.homepage_sections (key, title, sort_order, item_limit) values
  ('category_tiles', 'Shop by category', 10, 4),
  ('bestsellers', 'Bestsellers', 20, 8),
  ('most_viewed', 'Most viewed', 30, 8),
  ('latest', 'Latest arrivals', 40, 8),
  ('promo_banners', 'Promotions', 50, 2),
  ('featured', 'Featured', 60, 8),
  ('brand_showcase', 'The Artisanal Portfolio', 25, 2)
on conflict (key) do nothing;

-- Categories --------------------------------------------------------------------
insert into public.categories (name, slug, description, image_url, sort_order, show_in_nav) values
  ('Almonds', 'almonds', 'Whole, sliced and roasted almonds in everyday and gifting packs.', '/placeholders/almonds.svg', 10, true),
  ('Cashews', 'cashews', 'Whole and roasted cashews, graded by size.', '/placeholders/cashews.svg', 20, true),
  ('Walnuts', 'walnuts', 'Walnut kernels and in-shell walnuts.', '/placeholders/walnuts.svg', 30, true),
  ('Pistachios', 'pistachios', 'Roasted and salted pistachios.', '/placeholders/pistachios.svg', 40, true),
  ('Raisins', 'raisins', 'Golden, black and green raisins.', '/placeholders/raisins.svg', 50, true),
  ('Dates', 'dates', 'Soft and premium dates.', '/placeholders/dates.svg', 60, true),
  ('Seeds', 'seeds', 'Pumpkin, sunflower, chia and flax seeds.', '/placeholders/seeds.svg', 70, true),
  ('Trail Mix', 'trail-mix', 'Ready-to-eat mixes of nuts, seeds and berries.', '/placeholders/trail-mix.svg', 80, true),
  ('Gift Hampers', 'gift-hampers', 'Festive and corporate gift boxes.', '/brand/heritage-peacock-box.webp', 90, true),
  ('Dried Apricots', 'dried-apricots', 'Sun-dried apricots.', '/placeholders/apricots.svg', 100, false),
  ('Dried Figs', 'dried-figs', 'Dried figs (anjeer).', '/placeholders/figs.svg', 110, false),
  ('Cranberries', 'cranberries', 'Dried cranberries.', '/placeholders/cranberries.svg', 120, false),
  ('Blueberries', 'blueberries', 'Dried blueberries.', '/placeholders/blueberries.svg', 130, false),
  ('Corn Nuts', 'corn-nuts', 'Crunchy roasted corn snacks.', '/placeholders/corn-nuts.svg', 140, false)
on conflict (slug) do nothing;

-- Sample products ---------------------------------------------------------------
-- (slug, name, category slug, image, short description, [label, grams, price, compare_at, stock]...)
do $$
declare
  rec record;
  v_product uuid;
  v_variant uuid;
  v jsonb;
  i integer;
begin
  for rec in
    select * from (values
      ('california-almonds', 'California Almonds', 'almonds', 'almonds', 'Crunchy whole almonds, vacuum packed for freshness.', true, 1, true, 1,
        '[{"label":"250 g","g":250,"p":32900,"c":39900,"s":120},{"label":"500 g","g":500,"p":62900,"c":75900,"s":80},{"label":"1 kg","g":1000,"p":119900,"c":145000,"s":40}]'),
      ('roasted-salted-almonds', 'Roasted & Salted Almonds', 'almonds', 'almonds', 'Slow-roasted almonds with a light touch of salt.', false, 0, true, 5,
        '[{"label":"200 g","g":200,"p":29900,"c":34900,"s":60}]'),
      ('whole-cashews-w320', 'Whole Cashews W320', 'cashews', 'cashews', 'Whole cashew kernels, W320 grade.', true, 2, true, 2,
        '[{"label":"250 g","g":250,"p":34900,"c":42900,"s":100},{"label":"500 g","g":500,"p":67900,"c":82900,"s":50}]'),
      ('roasted-pepper-cashews', 'Roasted Pepper Cashews', 'cashews', 'cashews', 'Roasted cashews seasoned with black pepper.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":32900,"c":null,"s":35}]'),
      ('walnut-kernels', 'Walnut Kernels (Light Halves)', 'walnuts', 'walnuts', 'Light halves walnut kernels.', true, 3, true, 3,
        '[{"label":"200 g","g":200,"p":34900,"c":41900,"s":70},{"label":"500 g","g":500,"p":82900,"c":99900,"s":25}]'),
      ('inshell-walnuts', 'In-shell Walnuts', 'walnuts', 'walnuts', 'Whole walnuts in shell.', false, 0, false, 0,
        '[{"label":"1 kg","g":1000,"p":74900,"c":89900,"s":20}]'),
      ('roasted-salted-pistachios', 'Roasted & Salted Pistachios', 'pistachios', 'pistachios', 'In-shell pistachios, roasted and lightly salted.', true, 4, true, 4,
        '[{"label":"250 g","g":250,"p":39900,"c":47900,"s":90},{"label":"500 g","g":500,"p":76900,"c":91900,"s":45}]'),
      ('golden-raisins', 'Golden Raisins', 'raisins', 'raisins', 'Plump golden raisins.', false, 0, true, 6,
        '[{"label":"250 g","g":250,"p":14900,"c":17900,"s":150},{"label":"500 g","g":500,"p":27900,"c":33900,"s":80}]'),
      ('black-raisins-seedless', 'Black Raisins (Seedless)', 'raisins', 'raisins', 'Seedless black raisins.', false, 0, false, 0,
        '[{"label":"250 g","g":250,"p":17900,"c":null,"s":8}]'),
      ('soft-dates', 'Soft Dates', 'dates', 'dates', 'Naturally sweet soft dates.', false, 0, false, 0,
        '[{"label":"400 g","g":400,"p":24900,"c":29900,"s":60}]'),
      ('pumpkin-seeds', 'Roasted Pumpkin Seeds', 'seeds', 'seeds', 'Lightly roasted pumpkin seeds.', false, 0, true, 7,
        '[{"label":"200 g","g":200,"p":19900,"c":24900,"s":75}]'),
      ('sunflower-seeds', 'Sunflower Seeds', 'seeds', 'seeds', 'Hulled sunflower seeds.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":12900,"c":null,"s":0}]'),
      ('berry-nut-trail-mix', 'Berry & Nut Trail Mix', 'trail-mix', 'trail-mix', 'A mix of almonds, cashews, raisins and cranberries.', true, 5, true, 8,
        '[{"label":"200 g","g":200,"p":27900,"c":32900,"s":55}]'),
      ('festive-gift-hamper', 'Festive Dry Fruit Hamper', 'gift-hampers', 'gift-hampers', 'A gift box of almonds, cashews, pistachios and raisins.', true, 6, false, 0,
        '[{"label":"4 x 200 g","g":800,"p":149900,"c":179900,"s":30}]'),
      ('dried-apricots', 'Dried Apricots', 'dried-apricots', 'apricots', 'Sun-dried apricots.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":22900,"c":26900,"s":40}]'),
      ('dried-figs', 'Dried Figs (Anjeer)', 'dried-figs', 'figs', 'Soft dried figs.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":34900,"c":39900,"s":40}]'),
      ('dried-cranberries', 'Sliced Dried Cranberries', 'cranberries', 'cranberries', 'Sweetened sliced dried cranberries.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":24900,"c":29900,"s":40}]'),
      ('dried-blueberries', 'Dried Blueberries', 'blueberries', 'blueberries', 'Sweetened dried blueberries.', false, 0, false, 0,
        '[{"label":"150 g","g":150,"p":39900,"c":44900,"s":25}]'),
      ('masala-corn-nuts', 'Masala Corn Nuts', 'corn-nuts', 'corn-nuts', 'Crunchy roasted corn with Indian masala.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":9900,"c":null,"s":100}]')
    ) as t(slug, name, cat, img, short, featured, frank, best, brank, variants)
  loop
    insert into public.products (
      name, slug, short_description, description, storage_instructions, status, is_featured, featured_rank,
      is_bestseller, bestseller_rank, published_at
    ) values (
      rec.name, rec.slug, rec.short,
      rec.short || ' SAMPLE PRODUCT — replace description, ingredients, labelling and images with verified information before launch.',
      'Store in a cool, dry place. Once opened, transfer to an airtight container.',
      'active', rec.featured, rec.frank, rec.best, rec.brank, now() - interval '1 day' * (random() * 30)::int
    )
    on conflict (slug) do nothing
    returning id into v_product;

    if v_product is null then
      continue;
    end if;

    insert into public.product_categories (product_id, category_id)
    select v_product, c.id from public.categories c where c.slug = rec.cat;

    insert into public.product_images (product_id, url, alt, sort_order)
    values (v_product, '/placeholders/' || rec.img || '.svg', rec.name || ' (placeholder image)', 0);

    i := 0;
    for v in select * from jsonb_array_elements(rec.variants::jsonb)
    loop
      insert into public.product_variants (product_id, sku, label, weight_grams, price_paise, compare_at_paise, sort_order)
      values (
        v_product,
        upper(regexp_replace(rec.slug, '[^a-z0-9]+', '-', 'g')) || '-' || upper(regexp_replace(v ->> 'label', '[^A-Za-z0-9]+', '', 'g')),
        v ->> 'label', (v ->> 'g')::int, (v ->> 'p')::bigint, nullif(v ->> 'c', '')::bigint, i
      )
      returning id into v_variant;
      update public.inventory set on_hand = (v ->> 's')::int where variant_id = v_variant;
      insert into public.inventory_movements (variant_id, reason, delta_on_hand, note)
      values (v_variant, 'initial', (v ->> 's')::int, 'Seed stock');
      i := i + 1;
    end loop;
    v_product := null;
  end loop;
end;
$$;

-- Homepage banners (original placeholder artwork) --------------------------------
insert into public.homepage_banners (placement, title, subtitle, cta_label, link_url, image_url, alt, theme, sort_order)
select * from (values
  ('hero'::public.banner_placement, 'Discover India’s handcrafted wonders', 'Artisanal luxury, curated for you — heirloom gift boxes, hand-painted jars and embroidered pouches.', 'Explore gift collections', '/category/gift-hampers', '/brand/hero-gift-collection.webp', 'Bharat Secrets gift boxes, jars and embroidered pouches arranged on a festive table', 'walnut', 10),
  ('hero'::public.banner_placement, 'The Bharat Secrets portfolio', 'Dry fruits, saffron and spices presented in carved caskets and royal trunks.', 'Shop the collection', '/shop', '/brand/hero-portfolio.webp', 'Bharat Secrets jars, caskets and dry fruits displayed in a carved wooden haveli', 'saffron', 20),
  ('category_tile'::public.banner_placement, 'Apricots', null, null, '/category/dried-apricots', '/placeholders/apricots.svg', 'Dried apricots (placeholder artwork)', 'saffron', 10),
  ('category_tile'::public.banner_placement, 'Dried Figs', null, null, '/category/dried-figs', '/placeholders/figs.svg', 'Dried figs (placeholder artwork)', 'walnut', 20),
  ('category_tile'::public.banner_placement, 'Cranberries', null, null, '/category/cranberries', '/placeholders/cranberries.svg', 'Dried cranberries (placeholder artwork)', 'olive', 30),
  ('category_tile'::public.banner_placement, 'Blueberries', null, null, '/category/blueberries', '/placeholders/blueberries.svg', 'Dried blueberries (placeholder artwork)', 'cream', 40),
  ('promo'::public.banner_placement, 'Crispy, crunchy corn nuts', 'Tea-time snacking, sorted.', 'Shop corn nuts', '/category/corn-nuts', '/placeholders/corn-nuts.svg', 'Corn nuts (placeholder artwork)', 'saffron', 10),
  ('promo'::public.banner_placement, 'Raisins for every recipe', 'Golden, black and green raisins.', 'Shop raisins', '/category/raisins', '/placeholders/raisins.svg', 'Raisins (placeholder artwork)', 'olive', 20)
) as t(placement, title, subtitle, cta_label, link_url, image_url, alt, theme, sort_order)
where not exists (select 1 from public.homepage_banners);

-- Policy & content page TEMPLATES -------------------------------------------------
insert into public.content_pages (slug, title, body) values
  ('about', 'About us', E'Bharat Secrets brings India’s treasured dry fruits to homes and gifting tables.\n\nTell your story here: where you source from, how you pack, and what you stand for.\n\n[TEMPLATE — replace with your real story before launch.]'),
  ('shipping-policy', 'Shipping policy', E'We ship across serviceable PIN codes in India.\n\n## Dispatch\nOrders are usually dispatched within 1–2 business days.\n\n## Delivery time\nDelivery typically takes 3–7 business days depending on location.\n\n## Shipping charges\nA flat shipping fee applies below the free-shipping threshold shown at checkout.\n\n[TEMPLATE — confirm timelines and charges with your courier partner before launch.]'),
  ('returns-policy', 'Return, refund and cancellation policy', E'## Cancellations\nUnpaid orders and cash-on-delivery orders can be cancelled from your account before they are processed.\n\n## Returns\nBecause these are food products, returns are accepted only for damaged, incorrect or expired items reported within 48 hours of delivery with photos.\n\n## Refunds\nApproved refunds are issued to the original payment method. Banks may take 5–7 business days to credit the amount.\n\n[TEMPLATE — review with a legal advisor before launch.]'),
  ('privacy-policy', 'Privacy policy', E'We collect only the information needed to process orders and support you: name, contact details and delivery addresses.\n\nPayments are processed by Razorpay; we never store card numbers, CVV or UPI PIN.\n\nWe record anonymous product view counts without personal identifiers to show popular products.\n\n[TEMPLATE — review with a legal advisor, including obligations under the Digital Personal Data Protection Act, 2023.]'),
  ('terms', 'Terms and conditions', E'By using this website you agree to these terms.\n\nPrices are in Indian Rupees and include applicable taxes unless stated otherwise.\n\n[TEMPLATE — review with a legal advisor before launch.]'),
  ('faq', 'Frequently asked questions', E'## Do you offer cash on delivery?\nYes, for eligible orders and PIN codes. A COD fee may apply.\n\n## How do I track my order?\nOpen My Account → Orders to see the latest status and tracking link once shipped.\n\n## How should I store dry fruits?\nKeep them in a cool, dry place in an airtight container after opening.\n\n[TEMPLATE — edit to match your policies.]')
on conflict (slug) do nothing;

-- Example coupon (inactive by default; enable from the admin panel).
insert into public.coupons (code, description, discount_type, discount_value, max_discount_paise, min_order_paise, per_customer_limit, is_active)
values ('WELCOME10', '10% off your first order (max ₹150)', 'percentage', 10, 15000, 49900, 1, false)
on conflict (code) do nothing;
