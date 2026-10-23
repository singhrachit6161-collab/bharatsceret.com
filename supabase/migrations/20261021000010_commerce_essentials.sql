-- Commerce essentials:
--   1. GST tax invoices (sequential numbering per financial year, immutable snapshot)
--   2. Customer return / refund requests after delivery
--   3. Back-in-stock alerts
--   4. Carrier (Shiprocket) shipment fields and an idempotent carrier-event function
-- Additive only: no existing data is modified or deleted.

-- ---------------------------------------------------------------------------
-- 1. GST invoices
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists hsn_code text check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$'),
  add column if not exists gst_rate numeric(5, 2) check (gst_rate is null or gst_rate in (0, 0.25, 3, 5, 12, 18, 28, 40));

create table public.invoice_sequences (
  fiscal_year text primary key check (fiscal_year ~ '^[0-9]{4}$'),
  last_number integer not null default 0 check (last_number >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  invoice_number text not null unique check (char_length(invoice_number) between 1 and 16),
  document_type text not null check (document_type in ('tax_invoice', 'bill_of_supply')),
  fiscal_year text not null,
  issued_at timestamptz not null default now(),
  seller jsonb not null,
  buyer jsonb not null,
  place_of_supply text,
  intra_state boolean not null,
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) > 0),
  taxable_paise bigint not null check (taxable_paise >= 0),
  cgst_paise bigint not null default 0 check (cgst_paise >= 0),
  sgst_paise bigint not null default 0 check (sgst_paise >= 0),
  igst_paise bigint not null default 0 check (igst_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoices_math check (total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise),
  constraint invoices_split check (
    (intra_state and igst_paise = 0) or (not intra_state and cgst_paise = 0 and sgst_paise = 0)
  )
);

-- Invoices are immutable once issued.
create or replace function public.invoices_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'INVOICE_IMMUTABLE';
end;
$$;
create trigger invoices_no_update before update or delete on public.invoices
  for each row execute function public.invoices_immutable();

-- Issue (or return) the invoice for an order. The document body is computed by
-- trusted server code; numbering, eligibility and totals are enforced here.
create or replace function public.issue_invoice(p_order_id uuid, p_document jsonb, p_actor uuid)
returns table (invoice_id uuid, invoice_number text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_existing record;
  v_local timestamp := now() at time zone 'Asia/Kolkata';
  v_start integer;
  v_fy text;
  v_prefix text;
  v_n integer;
  v_number text;
  v_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  select i.id, i.invoice_number into v_existing from public.invoices i where i.order_id = p_order_id;
  if found then
    return query select v_existing.id, v_existing.invoice_number, false;
    return;
  end if;
  if v_order.status not in ('packed', 'shipped', 'out_for_delivery', 'delivered', 'refunded', 'partially_refunded')
     or not (v_order.payment_method = 'cod' or v_order.payment_status in ('paid', 'refunded', 'partially_refunded')) then
    raise exception 'INVOICE_NOT_READY';
  end if;
  if (p_document ->> 'total_paise')::bigint is distinct from v_order.total_paise then
    raise exception 'INVOICE_TOTAL_MISMATCH';
  end if;

  -- Indian financial year: April to March, written as e.g. "2627".
  v_start := case when extract(month from v_local) >= 4 then extract(year from v_local)::int else extract(year from v_local)::int - 1 end;
  v_fy := lpad((v_start % 100)::text, 2, '0') || lpad(((v_start + 1) % 100)::text, 2, '0');
  select upper(coalesce(value ->> 'invoice_prefix', '')) into v_prefix from public.store_settings where key = 'business';
  if v_prefix is null or v_prefix !~ '^[A-Z0-9]{1,6}$' then
    v_prefix := 'INV';
  end if;

  insert into public.invoice_sequences as s (fiscal_year, last_number) values (v_fy, 1)
  on conflict (fiscal_year) do update set last_number = s.last_number + 1
  returning s.last_number into v_n;
  v_number := v_prefix || '/' || v_fy || '/' || lpad(v_n::text, 5, '0');

  insert into public.invoices (
    order_id, invoice_number, document_type, fiscal_year, seller, buyer, place_of_supply, intra_state, lines,
    taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, created_by
  ) values (
    p_order_id, v_number, p_document ->> 'document_type', v_fy, p_document -> 'seller', p_document -> 'buyer',
    p_document ->> 'place_of_supply', (p_document ->> 'intra_state')::boolean, p_document -> 'lines',
    (p_document ->> 'taxable_paise')::bigint, (p_document ->> 'cgst_paise')::bigint, (p_document ->> 'sgst_paise')::bigint,
    (p_document ->> 'igst_paise')::bigint, (p_document ->> 'total_paise')::bigint, p_actor
  ) returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'invoice.issue', 'order', p_order_id::text, jsonb_build_object('invoice_number', v_number));
  return query select v_id, v_number, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Returns
-- ---------------------------------------------------------------------------
create type public.return_status as enum ('requested', 'approved', 'rejected', 'received', 'refunded', 'closed');

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  reason text not null check (reason in ('damaged', 'wrong_item', 'missing_item', 'quality', 'other')),
  details text not null check (char_length(details) between 10 and 1000),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  status public.return_status not null default 'requested',
  resolution_note text check (char_length(resolution_note) <= 1000),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index return_requests_order_idx on public.return_requests (order_id);
create index return_requests_status_idx on public.return_requests (status, created_at desc);
create unique index return_requests_one_open_idx on public.return_requests (order_id)
  where status in ('requested', 'approved', 'received');
create trigger return_requests_updated_at before update on public.return_requests
  for each row execute function public.set_updated_at();

create or replace function public.request_return(p_order_id uuid, p_reason text, p_details text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_cfg jsonb;
  v_window integer;
  v_item jsonb;
  v_ordered integer;
  v_clean jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_oi uuid;
  v_qty integer;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  select value into v_cfg from public.store_settings where key = 'returns';
  if coalesce((v_cfg ->> 'enabled')::boolean, false) is not true then
    raise exception 'RETURNS_DISABLED';
  end if;
  v_window := least(greatest(coalesce((v_cfg ->> 'window_days')::int, 7), 1), 60);

  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('delivered', 'partially_refunded') or v_order.delivered_at is null then
    raise exception 'RETURN_NOT_ALLOWED';
  end if;
  if v_order.delivered_at < now() - make_interval(days => v_window) then
    raise exception 'RETURN_WINDOW_CLOSED';
  end if;
  if p_reason not in ('damaged', 'wrong_item', 'missing_item', 'quality', 'other')
     or p_details is null or char_length(trim(p_details)) not between 10 and 1000 then
    raise exception 'INVALID_RETURN';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'INVALID_RETURN_ITEMS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_oi := (v_item ->> 'order_item_id')::uuid;
      v_qty := (v_item ->> 'quantity')::int;
    exception when others then
      raise exception 'INVALID_RETURN_ITEMS';
    end;
    if v_oi is null or v_qty is null or v_qty < 1 or v_oi = any (v_seen) then
      raise exception 'INVALID_RETURN_ITEMS';
    end if;
    select quantity into v_ordered from public.order_items where id = v_oi and order_id = v_order.id;
    if not found or v_qty > v_ordered then
      raise exception 'INVALID_RETURN_ITEMS';
    end if;
    v_seen := v_seen || v_oi;
    v_clean := v_clean || jsonb_build_object('order_item_id', v_oi, 'quantity', v_qty);
  end loop;

  begin
    insert into public.return_requests (order_id, user_id, reason, details, items)
    values (v_order.id, v_uid, p_reason, trim(p_details), v_clean)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'RETURN_ALREADY_OPEN';
  end;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'return.request', 'order', v_order.id::text, jsonb_build_object('return_id', v_id, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.update_return_request(p_return_id uuid, p_status public.return_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ret record;
  v_allowed public.return_status[];
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_ret from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'RETURN_NOT_FOUND';
  end if;
  v_allowed := case v_ret.status
    when 'requested' then array['approved', 'rejected']::public.return_status[]
    when 'approved' then array['received', 'refunded', 'closed']::public.return_status[]
    when 'received' then array['refunded', 'closed']::public.return_status[]
    else array[]::public.return_status[]
  end;
  if not (p_status = any (v_allowed)) then
    raise exception 'INVALID_TRANSITION' using detail = v_ret.status::text || ' -> ' || p_status::text;
  end if;
  if p_status in ('rejected', 'closed') and (p_note is null or char_length(trim(p_note)) < 3) then
    raise exception 'REASON_REQUIRED';
  end if;
  update public.return_requests
     set status = p_status,
         resolution_note = coalesce(nullif(left(trim(p_note), 1000), ''), resolution_note),
         decided_by = auth.uid(),
         decided_at = now()
   where id = v_ret.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'return.update', 'order', v_ret.order_id::text,
          jsonb_build_object('return_id', v_ret.id, 'from', v_ret.status, 'to', p_status, 'note', p_note));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Back-in-stock alerts
-- ---------------------------------------------------------------------------
create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create unique index stock_alerts_pending_idx on public.stock_alerts (variant_id, user_id) where notified_at is null;
create index stock_alerts_variant_idx on public.stock_alerts (variant_id) where notified_at is null;

-- The email comes from the verified auth record, never from the client.
create or replace function public.subscribe_stock_alert(p_variant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_pending integer;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if not exists (
    select 1 from public.product_variants v join public.products p on p.id = v.product_id
     where v.id = p_variant_id and v.is_active and p.status = 'active'
  ) then
    raise exception 'VARIANT_UNAVAILABLE';
  end if;
  if exists (select 1 from public.stock_alerts where variant_id = p_variant_id and user_id = v_uid and notified_at is null) then
    return 'already_subscribed';
  end if;
  select count(*) into v_pending from public.stock_alerts where user_id = v_uid and notified_at is null;
  if v_pending >= 30 then
    raise exception 'TOO_MANY_ALERTS';
  end if;
  insert into public.stock_alerts (variant_id, user_id, email) values (p_variant_id, v_uid, v_email);
  return 'subscribed';
end;
$$;

-- Pending alerts whose variant can now be bought (service role only).
create or replace function public.ready_stock_alerts(p_limit integer default 200)
returns table (alert_id uuid, email text, product_name text, product_slug text, variant_label text)
language sql
security definer
set search_path = ''
as $$
  select a.id, a.email, p.name, p.slug, v.label
    from public.stock_alerts a
    join public.product_variants v on v.id = a.variant_id
    join public.products p on p.id = v.product_id
    join public.inventory i on i.variant_id = v.id
   where a.notified_at is null and public.is_service_role()
     and v.is_active and p.status = 'active' and i.on_hand - i.reserved > 0
   order by a.created_at
   limit least(greatest(p_limit, 1), 500);
$$;

-- ---------------------------------------------------------------------------
-- 4. Carrier shipments
-- ---------------------------------------------------------------------------
alter table public.shipments
  add column if not exists provider text not null default 'manual' check (provider in ('manual', 'shiprocket')),
  add column if not exists provider_order_id text,
  add column if not exists courier_id text,
  add column if not exists label_url text check (label_url is null or label_url ~ '^https://');

-- Apply a verified carrier tracking event exactly once and move the order
-- forward along packed -> shipped -> out_for_delivery -> delivered (never back).
create or replace function public.apply_carrier_event(
  p_provider text, p_tracking_number text, p_status public.shipment_status,
  p_description text, p_location text, p_external_id text, p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ship record;
  v_order record;
  v_chain text[] := array['packed', 'shipped', 'out_for_delivery', 'delivered'];
  v_target text;
  v_from integer;
  v_to integer;
  v_inserted integer;
begin
  if not public.is_service_role() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_ship from public.shipments
   where provider = p_provider and tracking_number = p_tracking_number for update;
  if not found then
    return jsonb_build_object('result', 'unknown_shipment');
  end if;

  insert into public.shipment_events (shipment_id, status, description, location, source, external_event_id, occurred_at)
  values (v_ship.id, p_status, left(p_description, 300), left(p_location, 120), 'carrier', left(p_external_id, 200),
          coalesce(p_occurred_at, now()))
  on conflict (shipment_id, external_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('result', 'duplicate');
  end if;

  -- A delivered or returned shipment is final; later events are only logged.
  if v_ship.status not in ('delivered', 'rto', 'cancelled') then
    update public.shipments
       set status = p_status,
           shipped_at = case when p_status in ('shipped', 'in_transit', 'out_for_delivery', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
           delivered_at = case when p_status = 'delivered' then now() else delivered_at end
     where id = v_ship.id;
  end if;

  select * into v_order from public.orders where id = v_ship.order_id for update;
  v_target := case p_status
    when 'packed' then 'packed'
    when 'shipped' then 'shipped'
    when 'in_transit' then 'shipped'
    when 'out_for_delivery' then 'out_for_delivery'
    when 'delivered' then 'delivered'
    else null
  end;
  v_from := case when v_order.status in ('confirmed', 'processing') then 0 else coalesce(array_position(v_chain, v_order.status::text), -1) end;
  v_to := coalesce(array_position(v_chain, v_target), 0);
  if v_target is not null and v_from >= 0 and v_to > v_from then
    update public.orders
       set status = v_target::public.order_status,
           delivered_at = case when v_target = 'delivered' then now() else delivered_at end
     where id = v_order.id;
    perform public._record_status(v_order.id, v_order.status, v_target::public.order_status,
      'Carrier update: ' || coalesce(left(p_description, 200), p_status::text), null);
    return jsonb_build_object('result', 'applied', 'order_id', v_order.id, 'order_status', v_target,
      'order_number', v_order.order_number, 'contact_email', v_order.contact_email);
  end if;
  return jsonb_build_object('result', 'logged', 'order_id', v_order.id, 'order_status', v_order.status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings defaults (only added when missing)
-- ---------------------------------------------------------------------------
insert into public.store_settings (key, value) values
  ('business', '{"gst_registered": false, "legal_name": "", "gstin": "", "address": "", "state": "", "state_code": "", "invoice_prefix": "BS"}'),
  ('returns', '{"enabled": true, "window_days": 7, "policy_note": "Because our products are food, we accept returns only for items that arrive damaged, incorrect, missing or not fit for consumption. Please report within the return window with a clear description."}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.return_requests enable row level security;
alter table public.stock_alerts enable row level security;

create policy invoices_select on public.invoices for select to authenticated
  using (public.is_staff() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy return_requests_select on public.return_requests for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy stock_alerts_select on public.stock_alerts for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy stock_alerts_delete_own on public.stock_alerts for delete to authenticated
  using (user_id = auth.uid() and notified_at is null);

revoke all on public.invoices, public.invoice_sequences, public.return_requests, public.stock_alerts from anon, authenticated;
grant select on public.invoices, public.return_requests, public.stock_alerts to authenticated;
grant delete on public.stock_alerts to authenticated;
grant all on public.invoices, public.invoice_sequences, public.return_requests, public.stock_alerts to service_role;

revoke all on function public.issue_invoice(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid, jsonb, uuid) to service_role;
revoke all on function public.request_return(uuid, text, text, jsonb) from public, anon;
grant execute on function public.request_return(uuid, text, text, jsonb) to authenticated;
revoke all on function public.update_return_request(uuid, public.return_status, text) from public, anon;
grant execute on function public.update_return_request(uuid, public.return_status, text) to authenticated;
revoke all on function public.subscribe_stock_alert(uuid) from public, anon;
grant execute on function public.subscribe_stock_alert(uuid) to authenticated;
revoke all on function public.ready_stock_alerts(integer) from public, anon, authenticated;
grant execute on function public.ready_stock_alerts(integer) to service_role;
revoke all on function public.apply_carrier_event(text, text, public.shipment_status, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_carrier_event(text, text, public.shipment_status, text, text, text, timestamptz) to service_role;
revoke all on function public.invoices_immutable() from public, anon, authenticated;
-- Staff edit tax fields like any other product column (RLS still applies).
grant update (hsn_code, gst_rate) on public.products to authenticated;
