-- Metheues Clothings — migration 024
-- deliver_order(): the last step of fulfilment, which nothing could reach.
--
-- ============================================================ WHAT WAS WRONG
-- `fulfilments.delivered_at` has existed since 001 and is READ in nine
-- places — A12's timeline, A18's return decision, /account/orders,
-- /account/orders/[orderNumber], /track-order, the guest lookup route,
-- lib/orders/status.ts, components/site/order-status-pill.tsx, and the
-- return-window calculation inside request_return() itself.
--
-- NOTHING EVER WROTE IT. Not a route, not a screen, not a function. And it
-- is not simply a missing button: `advance_fulfilment` REFUSES the
-- transition outright —
--
--   if p_to not in ('processing', 'packed') then
--     raise exception 'advance_fulfilment: % is not a packing step; use ship_order';
--
-- while `ship_order` ends at `shipped` and goes no further. So `delivered`
-- was a real value in the `fulfilment_status` enum, present in
-- advance_fulfilment's own forward-walk array, that no code path could
-- produce. Verified on the live database: three fulfilments, `delivered_at`
-- null on every one.
--
-- TWO CONSEQUENCES, and the second is the one that costs a customer
-- something:
--
--  1. The process stopped at "shipped". A12's timeline never completed,
--     and a customer watching /track-order or /account/orders never saw
--     their order arrive.
--
--  2. THE RETURN WINDOW STARTED TOO EARLY. request_return() counts from
--     `coalesce(max(delivered_at), max(shipped_at), placed_at)`, which is
--     the right order of preference — but with delivered_at null it
--     always fell through to shipped_at. So the window began when the
--     parcel LEFT rather than when it arrived, and the customer silently
--     lost however many days it spent with the carrier. 007's coalesce was
--     written for exactly this and had nothing to prefer.
--
-- ===================================================== WHY A NEW FUNCTION
-- Rule 4: two writes. `orders.fulfilment_status` and
-- `fulfilments.delivered_at` are different tables, the Supabase JS client
-- has no transaction, and an order showing delivered with no timestamp (or
-- the reverse) is exactly the half-written state request_return() then
-- reads.
--
-- NOT folded into advance_fulfilment, although it would have fit the
-- forward-walk logic. That function's own comment draws the line: "This
-- function is deliberately NOT the one that ships. Tracking is what marks
-- an order shipped, because that is also what emails the customer."
-- Delivery is the same kind of event — it is about the parcel's real
-- history, not about moving a queue along — and it belongs beside
-- ship_order rather than inside the packing stepper. Adding a third
-- behaviour to advance_fulfilment would also have needed its `p_to not in`
-- guard loosened, which is the guard stopping someone marking an order
-- shipped without tracking.
--
-- ============================================================ FIVE GUARDS
--  * Paid. A delivered order that was never paid for is not a thing.
--  * Not cancelled.
--  * ALREADY SHIPPED, and this one is structural rather than a policy
--    choice: `delivered_at` is a column on `fulfilments`, and ship_order is
--    the only thing that creates a fulfilment row. Before it runs there is
--    nowhere to record a delivery. An order cannot arrive before it leaves.
--  * Not already delivered, so a second click cannot overwrite the real
--    date with today's.
--  * The timestamp cannot be in the future, and cannot predate shipping.
--
-- A PAST TIMESTAMP IS ALLOWED ON PURPOSE. Staff learn about a delivery
-- after it happens — the carrier says Tuesday and it is now Thursday — and
-- because the return window counts from this column, recording the real
-- date rather than the data-entry date is what gives the customer the days
-- they are owed. Defaulting to now() keeps the common case one click.
--
-- EVERY FULFILMENT OF THE ORDER GETS THE TIMESTAMP, not just one. The
-- schema permits several (a split shipment) even though ship_order refuses
-- to create a second today; writing to all of them that lack one is correct
-- for the single-row case and sane if that ever changes.
--
-- NO EMAIL. E1–E9 contains no delivery confirmation, so none is sent and
-- none is invented. That is a question for the design owner rather than a
-- gap to fill from here — it is recorded in docs/design-questions.md.
--
-- The actor label is read from `profiles` inside the function rather than
-- taken as a parameter, which differs from its 011 siblings deliberately:
-- 015 settled that the label a caller supplies can disagree with the
-- profile it names, and a new function has no identity to preserve.
--
-- Rule 3: revoked from public, anon and authenticated, granted to
-- service_role only.

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

  if v_paid <> 'paid' then
    raise exception 'deliver_order: order % is not paid (%)', v_number, v_paid;
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
    -- Belt and braces: 'shipped' without a fulfilment row would mean
    -- something other than ship_order moved the column.
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

revoke execute on function deliver_order(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant  execute on function deliver_order(uuid, uuid, timestamptz)
  to service_role;
