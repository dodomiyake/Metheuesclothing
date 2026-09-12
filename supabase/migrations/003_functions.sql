-- Metheues Clothings — integrity functions
-- These exist so the §18 guarantees hold even when the application is wrong.

-- ---------------------------------------------------------------------------
-- Stock decrement for a paid order.
--
-- §18: "Stock decreases exactly once and cannot become negative."
--      "Duplicate webhook delivery cannot decrease stock twice." (§9.3)
--
-- Both are structural here, not conventional:
--   * the unique index on (order_id, variant_id, kind) means a second call
--     inserts nothing, so the update below touches nothing;
--   * the CHECK (stock_quantity >= 0) means an oversell raises rather than
--     silently clamping to zero. A clamped count is a lie you find at stock-take.
--
-- Call this from the Stripe webhook handler AFTER the event has been recorded
-- in webhook_events. Safe to call repeatedly.
-- ---------------------------------------------------------------------------
create or replace function decrement_stock_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  with claimed as (
    insert into inventory_adjustments (variant_id, delta, kind, reason, order_id)
    select oi.variant_id,
           -oi.quantity,
           'sale',
           'Paid order ' || o.order_number,
           o.id
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.id = p_order_id
      and oi.variant_id is not null
    on conflict (order_id, variant_id, kind) where order_id is not null
    do nothing
    returning variant_id, delta
  )
  update product_variants pv
  set stock_quantity = pv.stock_quantity + c.delta
  from claimed c
  where pv.id = c.variant_id;

  get diagnostics v_rows = row_count;
  return v_rows;   -- 0 on a replayed webhook, which is the correct outcome
exception
  when check_violation then
    -- stock_quantity >= 0 failed: we sold something we did not have.
    -- Fail loudly. Do not clamp, do not swallow.
    raise exception 'Oversell on order %: stock would go negative', p_order_id
      using errcode = 'check_violation';
end;
$$;

-- ---------------------------------------------------------------------------
-- Restock on cancellation or an accepted return.
-- Separate kinds so a cancellation and a return can both touch the same
-- variant for the same order without colliding on the unique index.
-- ---------------------------------------------------------------------------
create or replace function restock_for_order(
  p_order_id uuid,
  p_kind adjustment_kind,
  p_reason text,
  p_actor uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_kind not in ('cancellation_restock','return_restock') then
    raise exception 'restock_for_order expects a restock kind, got %', p_kind;
  end if;

  with claimed as (
    insert into inventory_adjustments (variant_id, delta, kind, reason, order_id, actor_id)
    select oi.variant_id, oi.quantity, p_kind, p_reason, p_order_id, p_actor
    from order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    on conflict (order_id, variant_id, kind) where order_id is not null
    do nothing
    returning variant_id, delta
  )
  update product_variants pv
  set stock_quantity = pv.stock_quantity + c.delta
  from claimed c
  where pv.id = c.variant_id;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Server-authoritative pricing.
--
-- §12: "Never accept payable price, discount or total from the browser."
--      "Accept only variant ID and quantity during checkout creation."
--
-- The browser sends [{variant_id, quantity}]. This returns what it actually
-- costs, from the database. The result is what you hand to Stripe.
-- It refuses inactive or unpublished variants rather than quietly pricing them.
-- ---------------------------------------------------------------------------
create or replace function price_cart(p_items jsonb)
returns table (
  variant_id uuid,
  sku text,
  product_name text,
  colour text,
  size text,
  quantity integer,
  unit_price_pence integer,
  line_total_pence integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select pv.id,
         pv.sku,
         p.name,
         pv.colour,
         pv.size,
         (i->>'quantity')::int,
         pv.price_pence,
         pv.price_pence * (i->>'quantity')::int
  from jsonb_array_elements(p_items) as i
  join product_variants pv on pv.id = (i->>'variant_id')::uuid
  join products p on p.id = pv.product_id
  where pv.is_active
    and p.status = 'published'
    and (i->>'quantity')::int > 0;

  if not found then
    raise exception 'No purchasable variants in cart';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log is append-only. Enforced, not agreed.
-- §9.6 requires refunds, cancellations, archives and stock adjustments to be
-- audited; an audit trail the owner can edit is not an audit trail.
-- ---------------------------------------------------------------------------
create or replace function forbid_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_no_update before update on audit_logs
  for each row execute function forbid_audit_mutation();
create trigger audit_logs_no_delete before delete on audit_logs
  for each row execute function forbid_audit_mutation();

-- keep updated_at honest
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();
create trigger payments_touch before update on payments
  for each row execute function touch_updated_at();
