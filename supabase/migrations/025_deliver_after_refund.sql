-- Metheues Clothings — migration 025
-- deliver_order() must accept an order that was refunded after it shipped.
--
-- ============================================================= THE BUG
-- 024 shipped with `if v_paid <> 'paid' then raise`, copied from its two
-- siblings. In `advance_fulfilment` and `ship_order` that check is right:
-- both run BEFORE the parcel leaves, and nothing unpaid should be packed
-- or dispatched.
--
-- Delivery is the one fulfilment step that happens AFTER the money can
-- move again, and that is what the copied guard missed:
--
--   order paid -> shipped -> customer raises a return, or a partial
--   refund is issued -> THE PARCEL ARRIVES -> staff cannot record it
--
-- Found by probing the guards on the live database rather than by reading
-- the code. MC-10010 (partially_refunded) was refused with "is not paid",
-- and MC-10008 — `refunded` and `shipped`, a real order that genuinely
-- went out — could never have been marked delivered at all.
--
-- THE CONSEQUENCE IS THE ONE 024 EXISTS TO PREVENT. request_return()
-- counts the window from `coalesce(max(delivered_at), max(shipped_at),
-- placed_at)`, so an order stuck without a delivered_at falls back to the
-- dispatch date and the customer loses the days the parcel spent in
-- transit. A partial refund on one item would have quietly shortened the
-- returns window on the others.
--
-- ========================================================== THE FIX
-- Refuse only `pending` and `failed` — the two states that mean the money
-- never arrived. `paid`, `partially_refunded` and `refunded` all describe
-- an order that WAS paid for, and the `fulfilment_status = 'shipped'`
-- requirement below already proves it was dispatched, which ship_order
-- would not have allowed unless it was paid at the time.
--
-- So the payment check here is really asking "was this ever a real sale",
-- not "is the money still with us", and the message says so. Cancelled is
-- still refused by its own separate guard, which is the case that actually
-- means the parcel should not be arriving.
--
-- `create or replace` with the signature unchanged, the same move 015 and
-- 021 made, so 024's REVOKE survives and rule 3 needs no new grant.

create or replace function deliver_order(
  p_order_id     uuid,
  p_actor        uuid default null,
  p_delivered_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from    fulfilment_status;
  v_paid    payment_status;
  v_number  text;
  v_shipped timestamptz;
  v_when    timestamptz;
  v_label   text;
  v_rows    integer;
begin
  select fulfilment_status, payment_status, order_number
    into v_from, v_paid, v_number
  from orders where id = p_order_id
  for update;

  if not found then
    raise exception 'deliver_order: no such order';
  end if;

  -- Only the states that mean the money never arrived. A refund issued
  -- after dispatch does not stop a parcel being delivered. See the header.
  if v_paid in ('pending', 'failed') then
    raise exception 'deliver_order: order % was never paid for (%)', v_number, v_paid;
  end if;

  if v_from = 'cancelled' then
    raise exception 'deliver_order: order % is cancelled', v_number;
  end if;

  if v_from = 'delivered' then
    raise exception 'deliver_order: order % is already marked delivered', v_number;
  end if;

  if v_from <> 'shipped' then
    raise exception 'deliver_order: order % has not been dispatched yet (%). Add tracking first.',
      v_number, v_from;
  end if;

  select max(shipped_at) into v_shipped from fulfilments where order_id = p_order_id;

  if v_shipped is null then
    raise exception 'deliver_order: order % has no dispatch record to mark delivered', v_number;
  end if;

  v_when := coalesce(p_delivered_at, now());

  if v_when > now() then
    raise exception 'deliver_order: a delivery date cannot be in the future';
  end if;

  if v_when < v_shipped then
    raise exception 'deliver_order: order % was dispatched on %, so it cannot have arrived on %',
      v_number, to_char(v_shipped, 'DD Mon YYYY'), to_char(v_when, 'DD Mon YYYY');
  end if;

  update fulfilments
     set delivered_at = v_when
   where order_id = p_order_id
     and delivered_at is null;
  get diagnostics v_rows = row_count;

  update orders set fulfilment_status = 'delivered' where id = p_order_id;

  select coalesce(full_name, email::text) into v_label from profiles where id = p_actor;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    coalesce(v_label, 'Staff'),
    'fulfilment_delivered',
    'order',
    p_order_id::text,
    'Marked order ' || v_number || ' delivered on ' || to_char(v_when, 'DD Mon YYYY')
      || case when v_rows > 1 then ' (' || v_rows || ' parcels)' else '' end
      || '. The returns window runs from this date.'
  );

  return v_when;
end;
$$;
