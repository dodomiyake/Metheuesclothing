-- 021 — request_return() writes an audit row.
--
-- A23's footer has named this as a gap since the screen was built: a
-- return's PROGRESS is logged (receive_return, decide_return and
-- refund_return all write, from 014) but the customer RAISING one was not,
-- so the log showed a return being approved with no record of it having
-- been asked for. The frame draws the event — "Return requested", tone
-- Info, at 146:3756 — and nothing wrote it.
--
-- `create or replace` rather than a new function, the same move 015 made
-- for adjust_stock. The signature is unchanged, so the REVOKE from
-- 004_lock_down_functions.sql survives the replace; rule 3 says run the
-- advisor after this to confirm it, which is what 015 proved is worth
-- doing rather than assuming.
--
-- The body below is 008's, unchanged, with one insert added before the
-- return. Reproduced in full because a function cannot be patched in
-- pieces, and migrations here are never edited once applied (fix forward).
--
-- TWO CHOICES WORTH RECORDING.
--
-- actor_label is the customer's NAME where there is a profile and the word
-- "Customer" where there is not, rather than the frame's "System" or the
-- customer's email address. "System" is wrong — a person asked for this,
-- and every other entry in the log names one. The email is wrong for a
-- different reason: audit_logs is append-only by design, enforced by the
-- forbid_audit_mutation triggers, so an address written here can never be
-- erased, and A20 already records that erasing a customer has to null the
-- person out while the sales history stands. The return NUMBER in
-- entity_id is what connects the entry to the person, through A18, which
-- is both more useful and erasable.
--
-- The summary carries the item count and the value, which is what the
-- frame's own entry shows ("2 items · £142.00"). The customer's note is
-- deliberately NOT copied into it: it is their words about their parcel,
-- it is already on the return itself where A18 shows it, and the audit log
-- is the one table where putting it would make it permanent.

create or replace function request_return(
  p_order_id      uuid,
  p_items         jsonb,   -- [{order_item_id, quantity, reason}]
  p_customer_note text default null
) returns table (return_id uuid, return_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order        orders%rowtype;
  v_window_days  integer;
  v_window_from  timestamptz;
  v_return_id    uuid;
  v_return_no    text;
  v_item         record;
  v_actor_label  text;
  v_item_count   integer;
  v_value_pence  integer;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'Unknown order';
  end if;

  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Order % is not paid, so there is nothing to return',
      v_order.order_number;
  end if;

  if v_order.cancelled_at is not null then
    raise exception 'Order % was cancelled', v_order.order_number;
  end if;

  select return_window_days into v_window_days from store_settings;
  if v_window_days is null then
    raise exception 'store_settings.return_window_days is not configured';
  end if;

  -- The window runs from delivery where delivery is known, and only falls
  -- back to the order date where it is not. Counting from the order date on
  -- a parcel that took two weeks to arrive would quietly eat most of the
  -- customer's window, which is both unfair and, for UK consumer returns,
  -- the wrong date to be counting from.
  select coalesce(max(f.delivered_at), max(f.shipped_at), v_order.placed_at)
    into v_window_from
    from fulfilments f
   where f.order_id = v_order.id;

  v_window_from := coalesce(v_window_from, v_order.placed_at);

  if now() > v_window_from + make_interval(days => v_window_days) then
    raise exception 'The % day return window for order % closed on %',
      v_window_days, v_order.order_number,
      to_char(v_window_from + make_interval(days => v_window_days), 'DD Mon YYYY');
  end if;

  insert into returns (order_id, profile_id, customer_note)
  values (v_order.id, v_order.profile_id, p_customer_note)
  returning id, returns.return_number into v_return_id, v_return_no;

  for v_item in
    select (e->>'order_item_id')::uuid as order_item_id,
           (e->>'quantity')::integer   as quantity,
            e->>'reason'               as reason
    from jsonb_array_elements(p_items) e
  loop
    -- Ownership: the line must belong to THIS order. Without this check a
    -- customer could quote a valid order of their own and a line item id
    -- from somebody else's order, and return a garment they never bought.
    if not exists (
      select 1 from order_items oi
       where oi.id = v_item.order_item_id
         and oi.order_id = v_order.id
    ) then
      raise exception 'Item does not belong to order %', v_order.order_number;
    end if;

    -- Quantity: never more than were bought, counting what is already out
    -- on other returns. Rejected returns release their claim; everything
    -- else still holds it.
    if v_item.quantity > (
      select oi.quantity
           - coalesce((
               select sum(ri.quantity)
                 from return_items ri
                 join returns r on r.id = ri.return_id
                where ri.order_item_id = oi.id
                  and r.status <> 'rejected'
             ), 0)
        from order_items oi
       where oi.id = v_item.order_item_id
    ) then
      raise exception 'More of that item requested than remain returnable';
    end if;

    insert into return_items (return_id, order_item_id, quantity, reason)
    values (v_return_id, v_item.order_item_id, v_item.quantity, v_item.reason);
  end loop;

  if not exists (select 1 from return_items where return_items.return_id = v_return_id) then
    raise exception 'A return must include at least one item';
  end if;

  -- Everything above can still raise, and every raise rolls the whole
  -- function back. So the audit row is written only once the return is
  -- certain -- the same ordering the route-level writers follow, for the
  -- same reason: an append-only log cannot retract an entry.
  select coalesce(sum(ri.quantity), 0),
         coalesce(sum(ri.quantity * oi.unit_price_pence), 0)
    into v_item_count, v_value_pence
    from return_items ri
    join order_items oi on oi.id = ri.order_item_id
   where ri.return_id = v_return_id;

  select coalesce(nullif(trim(pr.full_name), ''), 'Customer')
    into v_actor_label
    from profiles pr
   where pr.id = v_order.profile_id;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    v_order.profile_id,
    coalesce(v_actor_label, 'Customer'),
    'return_requested',
    'return',
    v_return_id::text,
    format('%s item%s requested for return on order %s, %s.',
           v_item_count,
           case when v_item_count = 1 then '' else 's' end,
           v_order.order_number,
           to_char(v_value_pence / 100.0, 'FM£999,999,990.00'))
  );

  return query select v_return_id, v_return_no;
end;
$$;

-- Unchanged from 004, restated because a `create or replace` is the moment
-- to check rather than assume. Rule 3: run get_advisors(type: "security")
-- after this and confirm request_return is absent from the
-- SECURITY DEFINER findings.
revoke execute on function request_return(uuid, jsonb, text) from public, anon, authenticated;
grant  execute on function request_return(uuid, jsonb, text) to service_role;
