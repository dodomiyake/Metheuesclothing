-- Metheues Clothings — schema
-- Maps §10 of the T-Shirt-First MVP. Written for Supabase Postgres.
--
-- Money is INTEGER PENCE everywhere. Never float, never numeric-as-decimal in
-- application code. £284.00 is 28400. Floating point money is the bug you find
-- six months later in a reconciliation that is off by three pence.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums
create type product_type        as enum ('tshirt');            -- §10: only tshirt at launch
create type product_status      as enum ('draft','scheduled','published','archived');
create type collection_status   as enum ('scheduled','live','hidden');
create type actor_role          as enum ('customer','staff','owner');
create type payment_status      as enum ('pending','paid','failed','refunded','partially_refunded');
create type fulfilment_status   as enum ('not_started','processing','packed','shipped','delivered','cancelled');
create type return_status       as enum ('requested','label_issued','in_transit','received','approved','rejected','refunded');
create type adjustment_kind     as enum ('sale','cancellation_restock','return_restock','manual');

-- ---------------------------------------------------------------- people
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           citext not null,
  full_name       text,
  phone           text,
  role            actor_role not null default 'customer',
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at      timestamptz not null default now()
);
create unique index profiles_email_key on profiles (email);

create table addresses (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  label        text,
  recipient    text not null,
  line1        text not null,
  line2        text,
  city         text not null,
  postcode     text not null,
  country_code char(2) not null,
  phone        text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
-- exactly one default per customer, enforced rather than hoped for
create unique index addresses_one_default_per_profile on addresses (profile_id) where is_default;

-- ---------------------------------------------------------------- catalogue
create table collections (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  hero_path    text,
  hero_alt     text,
  status       collection_status not null default 'hidden',
  position     integer not null default 0,
  published_at timestamptz,
  seo_title    text,
  seo_description text,
  created_at   timestamptz not null default now()
);

create table products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,                       -- §10
  name             text not null,
  product_type     product_type not null default 'tshirt',
  status           product_status not null default 'draft',
  description_short text,
  design_story     text,
  -- garment specification: the size guide reads from here, so the two can never drift
  fit              text,
  fabric_weight_gsm integer check (fabric_weight_gsm > 0),
  composition      text,
  neck             text,
  made_in          text,
  care_instructions text,
  -- delivery data
  packed_weight_g  integer check (packed_weight_g > 0),
  hs_code          text,
  country_of_origin text,
  seo_title        text,
  seo_description  text,
  published_at     timestamptz,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table product_collections (
  product_id    uuid not null references products(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  position      integer not null default 0,
  primary key (product_id, collection_id)
);

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,
  -- NOT NULL by design: §13 requires text alternatives, and a nullable column
  -- means the rule lives in a code review instead of the database.
  alt_text   text not null check (length(btrim(alt_text)) > 0),
  colour     text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete cascade,
  colour              text not null,
  size                text not null,
  sku                 text not null unique,                     -- §10
  price_pence         integer not null check (price_pence >= 0),
  compare_at_pence    integer check (compare_at_pence >= 0),
  -- §18: "stock cannot become negative". This is why it cannot.
  stock_quantity      integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active           boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (product_id, colour, size)
);

-- ---------------------------------------------------------------- inventory
create table inventory_adjustments (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references product_variants(id) on delete restrict,
  delta       integer not null check (delta <> 0),
  kind        adjustment_kind not null,
  -- §9.3: "manual adjustments require a reason"
  reason      text not null check (length(btrim(reason)) > 0),
  note        text,
  actor_id    uuid references profiles(id),
  order_id    uuid,
  created_at  timestamptz not null default now()
);
-- THE exactly-once guarantee. A given order can only ever produce one sale
-- adjustment per variant, so a replayed Stripe webhook cannot decrement twice.
create unique index inventory_adjustments_once_per_order
  on inventory_adjustments (order_id, variant_id, kind)
  where order_id is not null;

-- ---------------------------------------------------------------- orders
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique,                      -- §10
  profile_id         uuid references profiles(id) on delete set null,  -- null = guest
  email              citext not null,
  currency           char(3) not null default 'GBP',
  subtotal_pence     integer not null check (subtotal_pence >= 0),
  delivery_pence     integer not null default 0 check (delivery_pence >= 0),
  discount_pence     integer not null default 0 check (discount_pence >= 0),
  total_pence        integer not null check (total_pence >= 0),
  payment_status     payment_status not null default 'pending',
  fulfilment_status  fulfilment_status not null default 'not_started',
  delivery_method    text,
  -- snapshots, not foreign keys: the customer's address may change later,
  -- but what we shipped to must not
  delivery_address   jsonb not null,
  billing_address    jsonb,
  customer_note      text,
  placed_at          timestamptz not null default now(),
  cancelled_at       timestamptz,
  cancel_reason      text,
  constraint orders_total_adds_up
    check (total_pence = subtotal_pence + delivery_pence - discount_pence)
);
create index orders_profile_idx on orders (profile_id);
create index orders_email_idx on orders (email);

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  -- kept for reporting only; nulled if the variant is ever deleted, because
  -- the snapshot below is the record of what was actually bought
  variant_id     uuid references product_variants(id) on delete set null,
  product_name   text not null,
  sku            text not null,
  colour         text not null,
  size           text not null,
  unit_price_pence integer not null check (unit_price_pence >= 0),
  quantity       integer not null check (quantity > 0),
  line_total_pence integer not null check (line_total_pence >= 0),
  constraint order_items_line_adds_up
    check (line_total_pence = unit_price_pence * quantity)
);
create index order_items_order_idx on order_items (order_id);

create table payments (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders(id) on delete cascade,
  stripe_checkout_session_id text not null unique,              -- §10
  stripe_payment_intent_id   text,
  amount_pence              integer not null check (amount_pence >= 0),
  status                    payment_status not null default 'pending',
  card_brand                text,
  card_last4                char(4),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
-- unique where present, per §10
create unique index payments_intent_key on payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table fulfilments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  carrier         text not null,
  tracking_number text not null,
  tracking_url    text,
  shipped_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  actor_id        uuid references profiles(id)
);

-- ---------------------------------------------------------------- returns
create table returns (
  id               uuid primary key default gen_random_uuid(),
  return_number    text not null unique,
  order_id         uuid not null references orders(id) on delete restrict,
  profile_id       uuid references profiles(id) on delete set null,
  status           return_status not null default 'requested',
  requested_at     timestamptz not null default now(),
  label_expires_at timestamptz,
  received_at      timestamptz,
  decided_at       timestamptz,
  decision_reason  text,
  refund_pence     integer check (refund_pence >= 0),
  customer_note    text
);

create table return_items (
  id            uuid primary key default gen_random_uuid(),
  return_id     uuid not null references returns(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete restrict,
  quantity      integer not null check (quantity > 0),
  reason        text not null,
  condition     text,
  restock       boolean not null default false
);

-- ---------------------------------------------------------------- plumbing
-- §12: process every webhook idempotently. Insert here FIRST; if the insert
-- conflicts, the event has already been handled and the handler returns 200
-- without doing the work again. No payload is stored — §12 forbids logging it.
create table webhook_events (
  stripe_event_id text primary key,
  event_type      text not null,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz
);

create table newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  consent_at    timestamptz not null default now(),
  source        text,
  unsubscribed_at timestamptz
);

-- single-row configuration table
create table store_settings (
  id                          boolean primary key default true check (id),
  free_delivery_threshold_pence integer not null check (free_delivery_threshold_pence >= 0),
  return_window_days          integer not null check (return_window_days > 0),
  collection_fee_pence        integer not null default 0 check (collection_fee_pence >= 0),
  vat_rate_basis_points       integer not null check (vat_rate_basis_points between 0 and 10000),
  contact_email               citext not null,
  from_email                  citext not null,
  maintenance_mode            boolean not null default false,
  updated_at                  timestamptz not null default now()
);

create table homepage_sections (
  key        text primary key,
  content    jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- append-only; see 002_rls.sql for the revoke that makes that true
create table audit_logs (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  actor_label text not null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  summary     text not null,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on audit_logs (created_at desc);
