-- Manual stock adjustment for the admin inventory screens (A08).
--
-- §9.3: "manual adjustments require a reason" -- inventory_adjustments.reason
-- already enforces that with a NOT NULL + non-blank CHECK. What it cannot
-- enforce on its own is the pairing: an adjustment row and the stock change
-- it describes must land together or not at all, which is rule 4 (multi-row
-- writes belong in a Postgres function) for the same reason
-- decrement_stock_for_order and restock_for_order already are one.
--
-- SECURITY DEFINER because 002_rls.sql is deliberate about this table: staff
-- get read-only access to inventory_adjustments and there is no INSERT
-- policy for them at all -- "stock only ever moves through the functions in
-- 003_functions.sql." This is the manual-adjustment member of that set.

create or replace function adjust_stock(
  p_variant_id uuid,
  p_mode       text,             -- 'add' | 'remove' | 'set'
  p_amount     integer,          -- quantity for add/remove, target value for set
  p_reason     text,
  p_note       text default null,
  p_actor      uuid default null
)
returns table (variant_id uuid, previous_stock integer, new_stock integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current integer;
  v_delta   integer;
begin
  if p_mode not in ('add', 'remove', 'set') then
    raise exception 'adjust_stock: mode must be add, remove or set';
  end if;
  if p_amount < 0 then
    raise exception 'adjust_stock: amount must not be negative';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'adjust_stock: a reason is required';
  end if;

  select stock_quantity into v_current
  from product_variants where id = p_variant_id
  for update;

  if not found then
    raise exception 'Unknown variant %', p_variant_id;
  end if;

  v_delta := case p_mode
    when 'add'    then p_amount
    when 'remove' then -p_amount
    when 'set'    then p_amount - v_current
  end;

  if v_delta = 0 then
    raise exception 'That change would not move stock';
  end if;

  -- §18: "stock cannot become negative." A removal larger than what's on
  -- hand is rejected here by the same CHECK constraint decrement_stock_for_
  -- order relies on, not clamped to zero -- a clamped count is a lie you
  -- find at stock-take.
  insert into inventory_adjustments (variant_id, delta, kind, reason, note, actor_id)
  values (p_variant_id, v_delta, 'manual', p_reason, p_note, p_actor);

  update product_variants
  set stock_quantity = stock_quantity + v_delta
  where id = p_variant_id;

  return query select p_variant_id, v_current, v_current + v_delta;
exception
  when check_violation then
    raise exception 'That would take stock below zero (currently %)', v_current;
end;
$$;

-- 004's rule, applied without exception.
revoke execute on function adjust_stock(uuid, text, integer, text, text, uuid)
  from public, anon, authenticated;
grant execute on function adjust_stock(uuid, text, integer, text, text, uuid)
  to service_role;
