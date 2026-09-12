-- Creating a return is several inserts that must all happen or none of them.
--
-- The Supabase JS client has no transaction. Doing this from the route means
-- inserting the `returns` row, then the `return_items` rows, and hoping the
-- second call succeeds — when it does not, the customer is left with an empty
-- return in 'requested' state that the admin queue will show as a return of
-- nothing. So the whole operation lives here, where it is one statement from
-- the caller's point of view and therefore one transaction.
--
-- The validation lives here too, for the same reason it lives in the database
-- everywhere else in this schema: a rule enforced in a route is enforced only
-- on the paths that remember to call that route.

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

  -- The window runs from delivery where delivery is known, and only falls back
  -- to the order date where it is not. Counting from the order date on a parcel
  -- that took two weeks to arrive would quietly eat most of the customer's
  -- window, which is both unfair and, for UK consumer returns, the wrong date
  -- to be counting from.
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
    -- customer could quote a valid order of their own and a line item id from
    -- somebody else's order, and return a garment they never bought.
    if not exists (
      select 1 from order_items oi
       where oi.id = v_item.order_item_id
         and oi.order_id = v_order.id
    ) then
      raise exception 'Item does not belong to order %', v_order.order_number;
    end if;

    -- Quantity: never more than were bought, counting what is already out on
    -- other returns. Rejected returns release their claim; everything else
    -- still holds it.
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

  -- A return of nothing is not a return.
  if not exists (select 1 from return_items where return_items.return_id = v_return_id) then
    raise exception 'A return must include at least one item';
  end if;

  return query select v_return_id, v_return_no;
end;
$$;

-- 004's rule, applied without exception: SECURITY DEFINER means EXECUTE must be
-- revoked, or anon can POST to /rest/v1/rpc/request_return with any order id and
-- open returns against orders that are not theirs.
revoke execute on function request_return(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function request_return(uuid, jsonb, text) to service_role;
