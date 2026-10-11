-- Fulfilment transitions for the admin order actions (A13 Pack, A14 Add
-- tracking).
--
-- Both are multi-row writes, which is rule 4: advance_fulfilment touches
-- orders and audit_logs; ship_order touches orders, fulfilments and
-- audit_logs. The Supabase JS client has no transaction, so doing either
-- from a route leaves an order marked shipped with no fulfilment row behind
-- it -- the same failure request_return() exists to prevent.
--
-- SECURITY DEFINER for the reason 002_rls.sql gives: staff have
-- orders_staff_write (UPDATE on orders) but NO insert policy on fulfilments
-- and none at all on audit_logs, which is "insert-by-server, read-by-staff".
-- An append-only log that the actor can write directly is not append-only in
-- any useful sense.
--
-- THESE ARE THE FIRST FUNCTIONS IN THIS CODEBASE THAT WRITE A SUCCESS ROW TO
-- audit_logs. Every existing insert is a failure path -- oversell_detected
-- and email_delivery_failed -- so a payment that succeeded recorded nothing
-- and the A12 audit panel was empty for every healthy order. Dispatching
-- someone's parcel is exactly the kind of act an audit log is for, and doing
-- it here rather than in the route means it cannot be forgotten by a caller
-- or skipped by a second one.

-- ---------------------------------------------------------------- packing
-- A13's "Mark packed". Also covers starting work (not_started -> processing)
-- so the one function owns the whole pre-shipping sequence and the legal
-- transitions live in a single place.
create or replace function advance_fulfilment(
  p_order_id uuid,
  p_to       fulfilment_status,
  p_actor    uuid default null,
  p_actor_label text default 'Staff'
)
returns fulfilment_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from    fulfilment_status;
  v_paid    payment_status;
  v_number  text;
begin
  select fulfilment_status, payment_status, order_number
    into v_from, v_paid, v_number
  from orders where id = p_order_id
  for update;

  if not found then
    raise exception 'advance_fulfilment: no such order';
  end if;

  -- This function is deliberately NOT the one that ships. Tracking is what
  -- marks an order shipped (ship_order below), because that is also what
  -- emails the customer -- A13's own copy promises "a packed box sitting
  -- overnight never sends a shipping notice a day early".
  if p_to not in ('processing', 'packed') then
    raise exception 'advance_fulfilment: % is not a packing step; use ship_order', p_to;
  end if;

  if v_paid <> 'paid' then
    raise exception 'advance_fulfilment: order % is not paid (%)', v_number, v_paid;
  end if;

  if v_from = 'cancelled' then
    raise exception 'advance_fulfilment: order % is cancelled', v_number;
  end if;

  -- Never walk backwards. Marking a shipped order "packed" would un-ship it
  -- in the UI while the parcel is already with the carrier.
  if array_position(array['not_started','processing','packed','shipped','delivered']::text[], v_from::text)
     >= array_position(array['not_started','processing','packed','shipped','delivered']::text[], p_to::text) then
    raise exception 'advance_fulfilment: order % is already %', v_number, v_from;
  end if;

  update orders set fulfilment_status = p_to where id = p_order_id;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    p_actor_label,
    'fulfilment_' || p_to::text,
    'order',
    p_order_id::text,
    case p_to
      when 'processing' then 'Started preparing order ' || v_number
      else 'Marked order ' || v_number || ' packed'
    end
  );

  return p_to;
end;
$$;

revoke execute on function advance_fulfilment(uuid, fulfilment_status, uuid, text)
  from public, anon, authenticated;
grant execute on function advance_fulfilment(uuid, fulfilment_status, uuid, text)
  to service_role;

-- --------------------------------------------------------------- shipping
-- A14's "Add tracking". One call creates the fulfilment row AND moves the
-- order to shipped, because the design is explicit that these are the same
-- act: "Adding a carrier and number marks the order shipped and sends the
-- dispatch email -- there is no separate send button." Splitting them would
-- allow an order marked shipped with nothing to track, which is precisely
-- the state a customer emails about.
create or replace function ship_order(
  p_order_id        uuid,
  p_carrier         text,
  p_tracking_number text,
  p_tracking_url    text default null,
  p_actor           uuid default null,
  p_actor_label     text default 'Staff'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from   fulfilment_status;
  v_paid   payment_status;
  v_number text;
  v_id     uuid;
begin
  select fulfilment_status, payment_status, order_number
    into v_from, v_paid, v_number
  from orders where id = p_order_id
  for update;

  if not found then
    raise exception 'ship_order: no such order';
  end if;

  if btrim(coalesce(p_carrier, '')) = '' then
    raise exception 'ship_order: a carrier is required';
  end if;
  if btrim(coalesce(p_tracking_number, '')) = '' then
    raise exception 'ship_order: a tracking number is required';
  end if;

  if v_paid <> 'paid' then
    raise exception 'ship_order: order % is not paid (%)', v_number, v_paid;
  end if;
  if v_from = 'cancelled' then
    raise exception 'ship_order: order % is cancelled', v_number;
  end if;
  if v_from in ('shipped', 'delivered') then
    raise exception 'ship_order: order % is already %', v_number, v_from;
  end if;

  insert into fulfilments (order_id, carrier, tracking_number, tracking_url, actor_id)
  values (p_order_id, btrim(p_carrier), btrim(p_tracking_number), nullif(btrim(coalesce(p_tracking_url,'')), ''), p_actor)
  returning id into v_id;

  update orders set fulfilment_status = 'shipped' where id = p_order_id;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    p_actor_label,
    'fulfilment_shipped',
    'order',
    p_order_id::text,
    'Dispatched order ' || v_number || ' — ' || btrim(p_carrier) || ' ' || btrim(p_tracking_number)
  );

  return v_id;
end;
$$;

revoke execute on function ship_order(uuid, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function ship_order(uuid, text, text, text, uuid, text)
  to service_role;
