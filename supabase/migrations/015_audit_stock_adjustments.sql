-- Make a manual stock adjustment write to the audit log.
--
-- THIS PROJECT HAS NOW SHIPPED THE SAME FALSE CLAIM TWICE. The A01 sign-in
-- small print said stock adjustments were audited (corrected in 1d4059a),
-- and A07's footer said "every manual change needs a reason and is written
-- to the audit log" (corrected in d762e61). Both had to be narrowed because
-- adjust_stock wrote to inventory_adjustments and nothing else. The design
-- says it in two places and §9.6 lists a stock change among the events the
-- audit log must carry, so the cheaper fix is to make the claim true rather
-- than to keep retracting it -- and A23 Audit log is the screen that makes
-- the gap visible.
--
-- THE SIGNATURE IS UNCHANGED, deliberately. audit_logs.actor_label is NOT
-- NULL and adjust_stock only receives an actor uuid, so the obvious move is
-- a p_actor_label parameter -- which changes the function's identity and
-- therefore needs a DROP first, and this environment's Supabase tooling
-- gates DROP behind a confirmation that never arrives in a session (see
-- 014's note). The label is read from `profiles` inside the function
-- instead. That is arguably better anyway: the label then cannot disagree
-- with the profile it names, which it could if every caller passed its own.
--
-- inventory_adjustments still holds the quantitative record -- the delta,
-- the kind, the order it belonged to. The audit row is the human-readable
-- "who changed this, and when" A23 exists to answer. They are not
-- duplicates: one reconciles stock, the other reconciles people.

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
  v_sku     text;
  v_label   text;
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

  select stock_quantity, sku into v_current, v_sku
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

  -- Read rather than received -- see the header. 'System' covers an actor
  -- that is null (nothing calls it that way today, but the parameter
  -- defaults to null and audit_logs will not accept a null label).
  select coalesce(nullif(btrim(coalesce(full_name, '')), ''), email, 'Staff')
    into v_label
  from profiles where id = p_actor;
  v_label := coalesce(v_label, 'System');

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    v_label,
    'stock_adjusted',
    'variant',
    p_variant_id::text,
    v_sku || ' ' || v_current || ' to ' || (v_current + v_delta) || ' - ' || btrim(p_reason)
      || coalesce(' - ' || nullif(btrim(coalesce(p_note, '')), ''), '')
  );

  return query select p_variant_id, v_current, v_current + v_delta;
exception
  when check_violation then
    raise exception 'That would take stock below zero (currently %)', v_current;
end;
$$;

-- 004's rule, applied without exception. Re-stated because `create or
-- replace` keeps existing grants, and restating them is cheaper than
-- remembering whether it does.
revoke execute on function adjust_stock(uuid, text, integer, text, text, uuid)
  from public, anon, authenticated;
grant execute on function adjust_stock(uuid, text, integer, text, text, uuid)
  to service_role;
