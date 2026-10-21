-- Development / staging seed data.
-- * Products, prices and stock below are SAMPLE values so the storefront can be
--   exercised end-to-end. Replace them with your real catalogue before launch.
-- * Images point to labelled placeholder illustrations in /public/placeholders.
-- * Policy pages are TEMPLATES and must be reviewed by the business (and a legal
--   advisor) before going live. No certifications or health claims are made.
-- Safe to re-run: uses ON CONFLICT on natural keys.

-- Store settings --------------------------------------------------------------
insert into public.store_settings (key, value) values
  ('announcement', '{"enabled": true, "message": "The royal treasury of Bharat \u00b7 Delivered across India", "link_label": "Shop the collection", "link_url": "/shop"}'),
  ('store_contact', '{"brand_name": "Bharat Secrets", "legal_name": "", "email": "support@example.com", "phone": "", "whatsapp": "", "address": "", "hours": "Mon–Sat, 10:00–18:00 IST", "fssai_license": ""}'),
  ('shipping', '{"flat_fee_paise": 6900, "free_shipping_threshold_paise": 99900, "estimated_days_min": 3, "estimated_days_max": 7, "serviceable_pincode_prefixes": []}'),
  ('cod', '{"enabled": true, "fee_paise": 4900, "min_order_paise": 29900, "max_order_paise": 500000}'),
  ('checkout', '{"reservation_minutes": 30}'),
  ('social', '{"instagram": "", "facebook": "", "youtube": "", "x": ""}'),
  ('heritage', '{"enabled": true, "eyebrow": "From Bharat to the world", "title": "India\u2019s finest harvest, presented the royal way", "body": "Bharat Secrets brings together the dry fruits India has treasured for generations \u2014 selected, sorted and packed for homes and gifting tables in India and abroad. [TEMPLATE \u2014 replace with your own sourcing story, and only mention export standards or certifications you actually hold.]", "cta_label": "Our story", "cta_url": "/about", "image_url": "/brand/heritage-peacock-box.webp", "pillars": [{"title": "Thoughtfully sourced", "text": "Selected from India\u2019s celebrated growing regions."}, {"title": "Carefully graded", "text": "Sorted by size and quality before packing."}, {"title": "Gift-ready presentation", "text": "Elegant packs and hampers for every occasion."}]}'),
  ('trust_strip', '[{"icon": "truck", "title": "Shipping across India", "text": "Free shipping on orders above ₹999"}, {"icon": "package", "title": "Carefully packed", "text": "Sealed packs to keep products fresh"}, {"icon": "shield", "title": "Secure payments", "text": "UPI, cards and netbanking via Razorpay"}, {"icon": "headset", "title": "Customer support", "text": "Mon–Sat, 10:00–18:00 IST"}]')
on conflict (key) do nothing;

insert into public.homepage_sections (key, title, sort_order, item_limit) values
  ('category_tiles', 'The Collections', 10, 4),
  ('bestsellers', 'Bestsellers', 20, 8),
  ('brand_showcase', 'The Artisanal Portfolio', 25, 2),
  ('regions', 'Explore by region', 27, 12),
  ('most_viewed', 'Most viewed', 30, 8),
  ('latest', 'Latest arrivals', 40, 8),
  ('promo_banners', 'Promotions', 50, 2),
  ('featured', 'Featured', 60, 8)
on conflict (key) do nothing;

-- Category tree -------------------------------------------------------------------
-- (slug, name, parent slug, description, image, sort, show_in_nav)
-- Top-level collections appear in the main menu; children with show_in_nav
-- appear in each collection's dropdown. Regions and product types are both
-- categories, so a product can be in "Walnuts" and "Kashmir" at once.
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('dry-fruits', 'Dry Fruits', null, 'Almonds, cashews, pistachios, walnuts, raisins and dates — the heart of the royal pantry.', '/placeholders/almonds.svg', 10, true),
      ('flavour-lab', 'Flavour Lab', null, 'Small-batch flavoured nuts, makhana and roasts.', '/placeholders/makhana.svg', 20, true),
      ('spices', 'Spices', null, 'Single-origin, whole, ground and regional spice blends.', '/placeholders/spice.svg', 30, true),
      ('snacks', 'Snacks', null, 'Makhana, traditional namkeen, seeds and trail mixes.', '/placeholders/bhujia.svg', 40, true),
      ('pantry', 'Pantry', null, 'Honey, pickles, chutneys and speciality foods.', '/placeholders/honey.svg', 50, true),
      ('tea-beverages', 'Tea & Beverages', null, 'Kahwa, chai and regional teas.', '/placeholders/tea.svg', 60, true),
      ('regions', 'Regions', null, 'Discover India region by region.', '/brand/hero-portfolio.webp', 70, true),
      ('gifting', 'Gifting', null, 'Gift collections for festivals, weddings and corporate occasions.', '/brand/heritage-peacock-box.webp', 80, true),

      ('almonds', 'Almonds', 'dry-fruits', 'Whole, sliced and roasted almonds.', '/placeholders/almonds.svg', 10, true),
      ('cashews', 'Cashews', 'dry-fruits', 'Whole and roasted cashews, graded by size.', '/placeholders/cashews.svg', 20, true),
      ('pistachios', 'Pistachios', 'dry-fruits', 'Roasted and salted pistachios.', '/placeholders/pistachios.svg', 30, true),
      ('walnuts', 'Walnuts', 'dry-fruits', 'Walnut kernels and in-shell walnuts.', '/placeholders/walnuts.svg', 40, true),
      ('raisins', 'Raisins', 'dry-fruits', 'Golden, black and green raisins.', '/placeholders/raisins.svg', 50, true),
      ('dates', 'Dates', 'dry-fruits', 'Soft and premium dates.', '/placeholders/dates.svg', 60, true),
      ('dried-apricots', 'Dried Apricots', 'dry-fruits', 'Sun-dried apricots.', '/placeholders/apricots.svg', 70, false),
      ('dried-figs', 'Dried Figs', 'dry-fruits', 'Dried figs (anjeer).', '/placeholders/figs.svg', 80, false),
      ('cranberries', 'Cranberries', 'dry-fruits', 'Dried cranberries.', '/placeholders/cranberries.svg', 90, false),
      ('blueberries', 'Blueberries', 'dry-fruits', 'Dried blueberries.', '/placeholders/blueberries.svg', 100, false),

      ('flavoured-nuts', 'Flavoured Nuts', 'flavour-lab', 'Nuts tossed in Indian and global seasonings.', '/placeholders/cashews.svg', 10, true),
      ('flavoured-makhana', 'Flavoured Makhana', 'flavour-lab', 'Roasted fox nuts in bold flavours.', '/placeholders/makhana.svg', 20, true),
      ('roasted', 'Roasted', 'flavour-lab', 'Dry-roasted nuts and seeds.', '/placeholders/almonds.svg', 30, true),
      ('build-your-own-mix', 'Build Your Own', 'flavour-lab', 'Mix-and-match packs (coming soon).', '/placeholders/trail-mix.svg', 40, true),

      ('single-origin-spices', 'Single Origin', 'spices', 'Spices traceable to a single growing region.', '/placeholders/saffron.svg', 10, true),
      ('whole-spices', 'Whole Spices', 'spices', 'Cardamom, cloves, cinnamon and more.', '/placeholders/cardamom.svg', 20, true),
      ('ground-spices', 'Ground', 'spices', 'Freshly ground spice powders and masalas.', '/placeholders/spice.svg', 30, true),
      ('regional-blends', 'Regional Blends', 'spices', 'Heirloom masalas from India''s regional kitchens.', '/placeholders/spice.svg', 40, true),

      ('makhana', 'Makhana', 'snacks', 'Classic roasted fox nuts.', '/placeholders/makhana.svg', 10, true),
      ('traditional-snacks', 'Traditional Snacks', 'snacks', 'Namkeen and tea-time classics.', '/placeholders/bhujia.svg', 20, true),
      ('seeds', 'Seeds', 'snacks', 'Pumpkin, sunflower, chia and flax seeds.', '/placeholders/seeds.svg', 30, true),
      ('trail-mix', 'Trail Mixes', 'snacks', 'Ready-to-eat mixes of nuts, seeds and berries.', '/placeholders/trail-mix.svg', 40, true),
      ('corn-nuts', 'Corn Nuts', 'snacks', 'Crunchy roasted corn snacks.', '/placeholders/corn-nuts.svg', 50, false),

      ('honey', 'Honey', 'pantry', 'Raw and wild-forest honeys.', '/placeholders/honey.svg', 10, true),
      ('pickles', 'Pickles', 'pantry', 'Home-style achaar.', '/placeholders/pickle.svg', 20, true),
      ('chutneys', 'Chutneys', 'pantry', 'Sweet and savoury chutneys and preserves.', '/placeholders/chutney.svg', 30, true),
      ('specialty-foods', 'Specialty Foods', 'pantry', 'Jaggery, flours and regional specialities.', '/placeholders/jaggery.svg', 40, true),

      ('kahwa', 'Kahwa', 'tea-beverages', 'Saffron-and-spice green tea blends.', '/placeholders/tea.svg', 10, true),
      ('chai', 'Chai', 'tea-beverages', 'Masala chai blends.', '/placeholders/tea.svg', 20, true),
      ('regional-tea', 'Regional Tea', 'tea-beverages', 'Teas and infusions from India''s hills.', '/placeholders/tea.svg', 30, true),

      ('kashmir', 'Kashmir', 'regions', 'Walnuts, saffron and kahwa from the valley.', '/placeholders/saffron.svg', 10, true),
      ('punjab', 'Punjab', 'regions', 'Achaar and pantry classics from the land of five rivers.', '/placeholders/pickle.svg', 20, true),
      ('himachal', 'Himachal', 'regions', 'Orchard fruits and mountain preserves.', '/placeholders/chutney.svg', 30, true),
      ('uttarakhand', 'Uttarakhand', 'regions', 'Pahadi honey, herbs and teas.', '/placeholders/honey.svg', 40, true),
      ('rajasthan', 'Rajasthan', 'regions', 'Royal namkeen and desert spices.', '/placeholders/bhujia.svg', 50, true),
      ('uttar-pradesh', 'Uttar Pradesh', 'regions', 'Awadhi masalas, jaggery and sweets.', '/placeholders/jaggery.svg', 60, true),

      ('festive-gifts', 'Festivals', 'gifting', 'Diwali, Rakhi, Eid and Christmas gift boxes.', '/brand/products/floral-tin-box.webp', 10, true),
      ('wedding-gifts', 'Weddings', 'gifting', 'Favours, trousseau trays and shagun hampers.', '/brand/products/floral-pouches.webp', 20, true),
      ('corporate-gifts', 'Corporate', 'gifting', 'Branded and bulk gifting for teams and clients.', '/brand/products/red-gift-box.webp', 30, true),
      ('build-your-own-hamper', 'Build Your Own', 'gifting', 'Design your own hamper (coming soon).', '/brand/products/woven-box.webp', 40, true),
      ('luxury-gifts', 'Luxury', 'gifting', 'Carved caskets and heirloom trunks.', '/brand/products/carved-casket.webp', 50, true)
    ) as t(slug, name, parent, description, image_url, sort_order, show_in_nav)
  loop
    insert into public.categories (name, slug, description, image_url, sort_order, show_in_nav, parent_id)
    values (rec.name, rec.slug, rec.description, rec.image_url, rec.sort_order, rec.show_in_nav,
            (select id from public.categories where slug = rec.parent))
    on conflict (slug) do update
      set parent_id = excluded.parent_id,
          name = excluded.name,
          show_in_nav = excluded.show_in_nav,
          sort_order = excluded.sort_order;
  end loop;
end;
$$;

-- Sample products ---------------------------------------------------------------
-- (slug, name, comma-separated category slugs, image, short description, featured, rank, bestseller, rank, variants)
-- image: a placeholder name (public/placeholders/<name>.svg) or a site path.
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
      ('roasted-salted-almonds', 'Roasted & Salted Almonds', 'almonds,roasted', 'almonds', 'Slow-roasted almonds with a light touch of salt.', false, 0, true, 5,
        '[{"label":"200 g","g":200,"p":29900,"c":34900,"s":60}]'),
      ('whole-cashews-w320', 'Whole Cashews W320', 'cashews', 'cashews', 'Whole cashew kernels, W320 grade.', true, 2, true, 2,
        '[{"label":"250 g","g":250,"p":34900,"c":42900,"s":100},{"label":"500 g","g":500,"p":67900,"c":82900,"s":50}]'),
      ('roasted-pepper-cashews', 'Roasted Pepper Cashews', 'cashews,flavoured-nuts', 'cashews', 'Roasted cashews seasoned with black pepper.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":32900,"c":null,"s":35}]'),
      ('walnut-kernels', 'Kashmiri Walnut Kernels', 'walnuts,kashmir', 'walnuts', 'Light halves walnut kernels.', true, 3, true, 3,
        '[{"label":"200 g","g":200,"p":34900,"c":41900,"s":70},{"label":"500 g","g":500,"p":82900,"c":99900,"s":25}]'),
      ('inshell-walnuts', 'Kashmiri In-shell Walnuts', 'walnuts,kashmir', 'walnuts', 'Whole walnuts in shell.', false, 0, false, 0,
        '[{"label":"1 kg","g":1000,"p":74900,"c":89900,"s":20}]'),
      ('roasted-salted-pistachios', 'Roasted & Salted Pistachios', 'pistachios,roasted', 'pistachios', 'In-shell pistachios, roasted and lightly salted.', true, 4, true, 4,
        '[{"label":"250 g","g":250,"p":39900,"c":47900,"s":90},{"label":"500 g","g":500,"p":76900,"c":91900,"s":45}]'),
      ('golden-raisins', 'Golden Raisins', 'raisins', 'raisins', 'Plump golden raisins.', false, 0, true, 6,
        '[{"label":"250 g","g":250,"p":14900,"c":17900,"s":150},{"label":"500 g","g":500,"p":27900,"c":33900,"s":80}]'),
      ('black-raisins-seedless', 'Black Raisins (Seedless)', 'raisins', 'raisins', 'Seedless black raisins.', false, 0, false, 0,
        '[{"label":"250 g","g":250,"p":17900,"c":null,"s":8}]'),
      ('soft-dates', 'Soft Dates', 'dates', 'dates', 'Naturally sweet soft dates.', false, 0, false, 0,
        '[{"label":"400 g","g":400,"p":24900,"c":29900,"s":60}]'),
      ('pumpkin-seeds', 'Roasted Pumpkin Seeds', 'seeds,roasted', 'seeds', 'Lightly roasted pumpkin seeds.', false, 0, true, 7,
        '[{"label":"200 g","g":200,"p":19900,"c":24900,"s":75}]'),
      ('sunflower-seeds', 'Sunflower Seeds', 'seeds', 'seeds', 'Hulled sunflower seeds.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":12900,"c":null,"s":0}]'),
      ('berry-nut-trail-mix', 'Berry & Nut Trail Mix', 'trail-mix', 'trail-mix', 'A mix of almonds, cashews, raisins and cranberries.', true, 5, true, 8,
        '[{"label":"200 g","g":200,"p":27900,"c":32900,"s":55}]'),
      ('dried-apricots', 'Dried Apricots', 'dried-apricots', 'apricots', 'Sun-dried apricots.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":22900,"c":26900,"s":40}]'),
      ('dried-figs', 'Dried Figs (Anjeer)', 'dried-figs', 'figs', 'Soft dried figs.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":34900,"c":39900,"s":40}]'),
      ('dried-cranberries', 'Sliced Dried Cranberries', 'cranberries', 'cranberries', 'Sweetened sliced dried cranberries.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":24900,"c":29900,"s":40}]'),
      ('dried-blueberries', 'Dried Blueberries', 'blueberries', 'blueberries', 'Sweetened dried blueberries.', false, 0, false, 0,
        '[{"label":"150 g","g":150,"p":39900,"c":44900,"s":25}]'),
      ('masala-corn-nuts', 'Masala Corn Nuts', 'corn-nuts,traditional-snacks', 'corn-nuts', 'Crunchy roasted corn with Indian masala.', false, 0, false, 0,
        '[{"label":"200 g","g":200,"p":9900,"c":null,"s":100}]'),

      ('peri-peri-makhana', 'Peri Peri Makhana', 'flavoured-makhana', 'makhana', 'Roasted fox nuts with a fiery peri peri dusting.', true, 7, false, 0,
        '[{"label":"80 g","g":80,"p":19900,"c":24900,"s":80}]'),
      ('classic-roasted-makhana', 'Classic Roasted Makhana', 'makhana,roasted', 'makhana', 'Lightly salted roasted fox nuts.', false, 0, false, 0,
        '[{"label":"100 g","g":100,"p":17900,"c":null,"s":90}]'),
      ('salt-pepper-cashews', 'Himalayan Salt & Pepper Cashews', 'flavoured-nuts', 'cashews', 'Roasted cashews with rock salt and cracked pepper.', false, 0, false, 0,
        '[{"label":"150 g","g":150,"p":29900,"c":34900,"s":40}]'),
      ('kashmiri-saffron', 'Kashmiri Saffron (Kesar)', 'single-origin-spices,kashmir', 'saffron', 'Deep-red saffron threads.', true, 8, true, 9,
        '[{"label":"1 g","g":1,"p":49900,"c":59900,"s":60},{"label":"2 g","g":2,"p":94900,"c":115000,"s":40}]'),
      ('green-cardamom', 'Green Cardamom (Elaichi)', 'whole-spices', 'cardamom', 'Bold green cardamom pods.', false, 0, false, 0,
        '[{"label":"100 g","g":100,"p":34900,"c":39900,"s":50}]'),
      ('royal-garam-masala', 'Royal Garam Masala', 'ground-spices', 'spice', 'A warm, aromatic household masala.', false, 0, false, 0,
        '[{"label":"100 g","g":100,"p":14900,"c":null,"s":70}]'),
      ('awadhi-biryani-masala', 'Awadhi Biryani Masala', 'regional-blends,uttar-pradesh', 'spice', 'A fragrant blend in the Lucknowi style.', false, 0, false, 0,
        '[{"label":"100 g","g":100,"p":16900,"c":19900,"s":60}]'),
      ('bikaneri-bhujia', 'Bikaneri Bhujia', 'traditional-snacks,rajasthan', 'bhujia', 'Crisp gram-flour sev with spices.', false, 0, true, 10,
        '[{"label":"400 g","g":400,"p":17900,"c":null,"s":120}]'),
      ('pahadi-wild-honey', 'Pahadi Wild Forest Honey', 'honey,uttarakhand', 'honey', 'Wild-forest honey from the hills.', true, 9, false, 0,
        '[{"label":"350 g","g":350,"p":44900,"c":49900,"s":45}]'),
      ('punjabi-mango-pickle', 'Punjabi Mango Achaar', 'pickles,punjab', 'pickle', 'Home-style raw mango pickle in mustard oil.', false, 0, false, 0,
        '[{"label":"400 g","g":400,"p":24900,"c":null,"s":60}]'),
      ('himachali-apple-chutney', 'Himachali Apple Chutney', 'chutneys,himachal', 'chutney', 'Sweet-spiced apple chutney.', false, 0, false, 0,
        '[{"label":"250 g","g":250,"p":22900,"c":null,"s":40}]'),
      ('jaggery-cubes', 'Jaggery (Gur) Cubes', 'specialty-foods,uttar-pradesh', 'jaggery', 'Bite-sized jaggery cubes.', false, 0, false, 0,
        '[{"label":"500 g","g":500,"p":12900,"c":null,"s":100}]'),
      ('kashmiri-kahwa', 'Kashmiri Kahwa Blend', 'kahwa,kashmir', 'tea', 'Green tea with saffron, cardamom and cinnamon.', true, 10, true, 11,
        '[{"label":"100 g","g":100,"p":34900,"c":39900,"s":55}]'),
      ('masala-chai-blend', 'Royal Masala Chai Blend', 'chai', 'tea', 'Assam tea with ginger, cardamom and clove.', false, 0, false, 0,
        '[{"label":"250 g","g":250,"p":29900,"c":null,"s":70}]'),
      ('pahadi-herbal-tea', 'Pahadi Herbal Tea', 'regional-tea,uttarakhand', 'tea', 'A caffeine-free mountain herb infusion.', false, 0, false, 0,
        '[{"label":"50 g","g":50,"p":24900,"c":null,"s":40}]'),

      ('festive-gift-hamper', 'Festive Floral Tin Box', 'festive-gifts', '/brand/products/floral-tin-box.webp', 'Hand-painted tins of dry fruits in a floral keepsake box.', true, 6, true, 12,
        '[{"label":"6 tins","g":900,"p":249900,"c":279900,"s":30}]'),
      ('peacock-jar-box', 'Peacock Jar Box', 'festive-gifts,wedding-gifts', '/brand/products/peacock-box.webp', 'Four glass jars of dry fruits in a peacock-motif box.', true, 11, false, 0,
        '[{"label":"4 jars","g":800,"p":199900,"c":229900,"s":25}]'),
      ('wedding-favour-pouches', 'Wedding Favour Pouches (Set of 10)', 'wedding-gifts', '/brand/products/floral-pouches.webp', 'Embroidered drawstring pouches filled with dry fruits.', false, 0, false, 0,
        '[{"label":"10 pouches","g":1000,"p":149900,"c":null,"s":40}]'),
      ('woven-treasure-box', 'Woven Treasure Box', 'corporate-gifts,festive-gifts', '/brand/products/woven-box.webp', 'A hand-woven box of jars and treats.', false, 0, false, 0,
        '[{"label":"5 items","g":900,"p":229900,"c":null,"s":20}]'),
      ('signature-red-box', 'Signature Red Gift Box', 'corporate-gifts', '/brand/products/red-gift-box.webp', 'Our signature red box with walnuts, cardamom and spices.', false, 0, false, 0,
        '[{"label":"Standard","g":700,"p":179900,"c":null,"s":50}]'),
      ('maharaja-carved-casket', 'Maharaja Carved Casket', 'luxury-gifts,festive-gifts', '/brand/products/carved-casket.webp', 'A carved wooden casket of premium jars and saffron.', true, 12, false, 0,
        '[{"label":"Casket","g":1200,"p":499900,"c":549900,"s":10}]')
    ) as t(slug, name, cats, img, short, featured, frank, best, brank, variants)
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
    select v_product, c.id from public.categories c where c.slug = any (string_to_array(rec.cats, ','));

    insert into public.product_images (product_id, url, alt, sort_order)
    values (
      v_product,
      case when rec.img like '/%' then rec.img else '/placeholders/' || rec.img || '.svg' end,
      rec.name || case when rec.img like '/%' then '' else ' (placeholder image)' end,
      0
    );

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

-- Homepage banners ------------------------------------------------------------------
insert into public.homepage_banners (placement, title, subtitle, cta_label, link_url, image_url, alt, theme, sort_order)
select * from (values
  ('hero'::public.banner_placement, 'Discover India’s handcrafted wonders', 'Artisanal luxury, curated for you — heirloom gift boxes, hand-painted jars and embroidered pouches.', 'Explore gifting', '/category/gifting', '/brand/hero-gift-collection.webp', 'Bharat Secrets gift boxes, jars and embroidered pouches arranged on a festive table', 'walnut', 10),
  ('hero'::public.banner_placement, 'The Bharat Secrets portfolio', 'Dry fruits, saffron and spices presented in carved caskets and royal trunks.', 'Shop the collection', '/shop', '/brand/hero-portfolio.webp', 'Bharat Secrets jars, caskets and dry fruits displayed in a carved wooden haveli', 'saffron', 20),
  ('category_tile'::public.banner_placement, 'Dry Fruits', null, null, '/category/dry-fruits', '/placeholders/almonds.svg', 'Dry fruits (placeholder artwork)', 'walnut', 10),
  ('category_tile'::public.banner_placement, 'Spices', null, null, '/category/spices', '/placeholders/saffron.svg', 'Spices (placeholder artwork)', 'saffron', 20),
  ('category_tile'::public.banner_placement, 'Flavour Lab', null, null, '/category/flavour-lab', '/placeholders/makhana.svg', 'Flavour Lab (placeholder artwork)', 'olive', 30),
  ('category_tile'::public.banner_placement, 'Gifting', null, null, '/category/gifting', '/brand/products/carved-casket.webp', 'Carved gift casket', 'cream', 40),
  ('promo'::public.banner_placement, 'Tea from the hills', 'Kashmiri kahwa, masala chai and pahadi infusions.', 'Shop tea', '/category/tea-beverages', '/placeholders/tea.svg', 'Tea leaves (placeholder artwork)', 'saffron', 10),
  ('promo'::public.banner_placement, 'The royal pantry', 'Wild honey, achaar and chutneys.', 'Shop pantry', '/category/pantry', '/placeholders/honey.svg', 'Honey jar (placeholder artwork)', 'olive', 20)
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
