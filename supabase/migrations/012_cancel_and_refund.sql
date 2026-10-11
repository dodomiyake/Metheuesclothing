-- Cancel and refund (A15, A16), and the table that was missing under both.
--
-- THE SCHEMA COULD NOT RECORD A REFUND. payment_status has 'refunded' and
-- 'partially_refunded', and that is the whole of it: there is no amount, no
-- reason, no actor, no date, and nothing linking a refund to the Stripe
-- object that moved the money. So "partially refunded" meant "some unknown
-- amount, at some unknown time, by someone". A16 draws a partial refund with
-- a typed-amount confirmation, which cannot be built on top of a column that
-- only remembers that SOMETHING happened -- and a second partial refund had
-- no way to know what the first one had already returned, so nothing stopped
-- refunding £284 twice on a £284 order.
--
-- This adds the record, and the two functions that write it. Both are
-- multi-row writes (rule 4): cancel_order touches orders, refunds,
-- inventory_adjustments, product_variants and audit_logs; record_refund
-- touches refunds, payments, orders and audit_logs. Doing either from a route
-- leaves an order marked cancelled with the stock never returned.

-- ---------------------------------------------------------------- refunds
create table refunds (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  -- Integer pence, like every other money column here.
  amount_pence     integer not null check (amount_pence > 0),
  -- 'cancellation' came from A15 and always returns everything; 'refund' came
  -- from A16 and may be partial. Worth distinguishing: a month of
  -- cancellations and a month of refunds are different questions.
  kind             text not null check (kind in ('cancellation', 'refund')),
  reason           text not null,
  note             text,
  -- Whether THIS refund also put the goods back. A16 is explicit that money
  -- and stock are separate events, so it is recorded per refund rather than
  -- inferred.
  restocked        boolean not null default false,
  -- Stripe's own refund id. Null only when the money moved outside Stripe,
  -- which nothing in this app does yet but a manual bank transfer would.
  stripe_refund_id text,
  actor_id         uuid references profiles(id) on delete set null,
  -- NOT NULL for the same reason audit_logs.actor_label is: a deleted staff
  -- profile must not erase who issued a refund.
  actor_label      text not null,
  created_at       timestamptz not null default now()
);
create index refunds_order_idx on refunds (order_id);
-- Unique where present: the same Stripe refund must never be recorded twice,
-- but a manual refund with no Stripe id is allowed to repeat.
create unique index refunds_stripe_key on refunds (stripe_refund_id)
  where stripe_refund_id is not null;

alter table refunds enable row level security;

-- Read mirrors payments_own_read: the customer who owns the order, or staff.
-- There is deliberately no INSERT policy -- refunds are written by
-- record_refund/cancel_order running as service_role, for the same reason
-- 002_rls.sql gives staff no INSERT on inventory_adjustments. A row anyone
-- can write is not a financial record.
create policy refunds_own_read on refunds
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.profile_id = auth.uid() or is_staff()))
  );

-- ---------------------------------------------------------------- cancel
-- A15. One act with four consequences, which is why it is one function:
-- money back, stock back, customer told, order locked.
--
-- THE STRIPE REFUND IS NOT DONE HERE. Postgres cannot call Stripe, so the
-- route refunds first and passes the result in. That ordering is deliberate
-- and is the opposite of ship_order's: there the database write came first
-- because the parcel was already gone. Here the irreversible act is Stripe's,
-- and a cancellation recorded without the money actually moving is the worse
-- failure -- staff see "cancelled, refunded", stop looking, and the customer
-- never gets paid. Money out with the record missing is recoverable: Stripe
-- is the source of truth, charge.refunded still fires, and the route writes
-- an audit row naming the orphaned refund id.
create or replace function cancel_order(
  p_order_id         uuid,
  p_reason           text,
  p_amount_pence     integer,
  p_note             text default null,
  p_stripe_refund_id text default null,
  p_actor            uuid default null,
  p_actor_label      text default 'Staff'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fulfilment fulfilment_status;
  v_paid       payment_status;
  v_number     text;
  v_total      integer;
  v_units      integer;
begin
  select fulfilment_status, payment_status, order_number, total_pence
    into v_fulfilment, v_paid, v_number, v_total
  from orders where id = p_order_id
  for update;

  if not found then
    raise exception 'cancel_order: no such order';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'cancel_order: a reason is required';
  end if;

  if v_fulfilment = 'cancelled' then
    raise exception 'cancel_order: order % is already cancelled', v_number;
  end if;

  -- Once a parcel is with the carrier the goods have left the building, so
  -- "4 units go back into stock" would be a lie and the right path is a
  -- return, not a cancellation. A15's own consequence list says the order
  -- "can no longer be picked, packed or shipped", which only makes sense
  -- before it ships.
  if v_fulfilment in ('shipped', 'delivered') then
    raise exception 'cancel_order: order % has already been %; use a return and a refund instead', v_number, v_fulfilment;
  end if;

  if p_amount_pence is not null and p_amount_pence > v_total then
    raise exception 'cancel_order: % is more than order % totalled', p_amount_pence, v_number;
  end if;

  update orders
     set fulfilment_status = 'cancelled',
         cancelled_at      = now(),
         cancel_reason     = btrim(p_reason),
         -- Only a paid order has money to send back. An unpaid one is simply
         -- closed, and marking it refunded would invent a payment.
         payment_status    = case when v_paid = 'paid' then 'refunded'::payment_status else v_paid end
   where id = p_order_id;

  if v_paid = 'paid' then
    update payments set status = 'refunded', updated_at = now() where order_id = p_order_id;

    if p_amount_pence is not null and p_amount_pence > 0 then
      insert into refunds (order_id, amount_pence, kind, reason, note, restocked, stripe_refund_id, actor_id, actor_label)
      values (p_order_id, p_amount_pence, 'cancellation', btrim(p_reason),
              nullif(btrim(coalesce(p_note, '')), ''), true, p_stripe_refund_id, p_actor, p_actor_label);
    end if;
  end if;

  -- Unlike A16, the restock is NOT optional here and that is the real
  -- difference between the two screens: a cancelled order never left, so the
  -- goods are on the shelf by definition. restock_for_order is idempotent on
  -- (order_id, variant_id, kind), so a retry cannot double-count.
  v_units := restock_for_order(p_order_id, 'cancellation_restock'::adjustment_kind, 'Order ' || v_number || ' cancelled', p_actor);

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    p_actor_label,
    'order_cancelled',
    'order',
    p_order_id::text,
    'Cancelled order ' || v_number || ' - ' || btrim(p_reason)
      || case when v_paid = 'paid' and p_amount_pence > 0
              then ' - GBP ' || to_char(p_amount_pence / 100.0, 'FM999999990.00') || ' refunded'
              else ' - nothing to refund' end
      || ' - ' || v_units || ' line(s) restocked'
  );

  return v_units;
end;
$$;

revoke execute on function cancel_order(uuid, text, integer, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function cancel_order(uuid, text, integer, text, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------- refund
-- A16. Records a refund that Stripe has already made, and optionally puts the
-- goods back.
--
-- THE OVER-REFUND CHECK IS THE POINT OF THE SUM. Before this table existed
-- there was nothing to add up, so two partial refunds of £284 on a £284 order
-- both "succeeded". Stripe would have refused the second one, which is the
-- only reason it was never a live bug -- relying on the payment processor to
-- be your integrity constraint is not a control, it is luck.
create or replace function record_refund(
  p_order_id         uuid,
  p_amount_pence     integer,
  p_reason           text,
  p_restock          boolean default false,
  p_note             text default null,
  p_stripe_refund_id text default null,
  p_actor            uuid default null,
  p_actor_label      text default 'Staff'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_number    text;
  v_total     integer;
  v_paid      payment_status;
  v_already   integer;
  v_units     integer := 0;
begin
  select order_number, total_pence, payment_status
    into v_number, v_total, v_paid
  from orders where id = p_order_id
  for update;

  if not found then
    raise exception 'record_refund: no such order';
  end if;

  if v_paid not in ('paid', 'partially_refunded') then
    raise exception 'record_refund: order % is %, so there is nothing to refund', v_number, v_paid;
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'record_refund: a reason is required';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'record_refund: the amount must be more than zero';
  end if;

  select coalesce(sum(amount_pence), 0) into v_already from refunds where order_id = p_order_id;

  if v_already + p_amount_pence > v_total then
    raise exception 'record_refund: order % has already had GBP % refunded of GBP %; GBP % more would exceed it',
      v_number,
      to_char(v_already / 100.0, 'FM999999990.00'),
      to_char(v_total / 100.0, 'FM999999990.00'),
      to_char(p_amount_pence / 100.0, 'FM999999990.00');
  end if;

  insert into refunds (order_id, amount_pence, kind, reason, note, restocked, stripe_refund_id, actor_id, actor_label)
  values (p_order_id, p_amount_pence, 'refund', btrim(p_reason),
          nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_restock, false),
          p_stripe_refund_id, p_actor, p_actor_label);

  -- Fully refunded only when every penny is back. The webhook's own
  -- charge.refunded branch sets payments.status the same way; this sets the
  -- ORDER too, which that branch never did -- an order stayed 'paid' in the
  -- admin list after a full refund.
  update orders
     set payment_status = case when v_already + p_amount_pence >= v_total
                               then 'refunded'::payment_status
                               else 'partially_refunded'::payment_status end
   where id = p_order_id;

  update payments
     set status = case when v_already + p_amount_pence >= v_total
                       then 'refunded'::payment_status
                       else 'partially_refunded'::payment_status end,
         updated_at = now()
   where order_id = p_order_id;

  -- Separate event, separate tick box. restock_for_order is idempotent on
  -- (order_id, variant_id, kind), so ticking it on a second partial refund
  -- returns 0 rather than restocking the order twice.
  if coalesce(p_restock, false) then
    v_units := restock_for_order(p_order_id, 'return_restock'::adjustment_kind, 'Refund on order ' || v_number, p_actor);
  end if;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    p_actor_label,
    'order_refunded',
    'order',
    p_order_id::text,
    'Refunded GBP ' || to_char(p_amount_pence / 100.0, 'FM999999990.00')
      || ' on order ' || v_number || ' - ' || btrim(p_reason)
      || case when coalesce(p_restock, false)
              then ' - ' || v_units || ' line(s) restocked'
              else ' - stock not restored' end
  );

  return v_units;
end;
$$;

revoke execute on function record_refund(uuid, integer, text, boolean, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function record_refund(uuid, integer, text, boolean, text, text, uuid, text)
  to service_role;
