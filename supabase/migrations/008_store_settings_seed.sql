-- store_settings is a singleton (`id boolean primary key default true check (id)`)
-- and until now it had no row in it.
--
-- That is worse than it sounds. The checkout route falls back to a hardcoded
-- £150 threshold when the select returns nothing, so it looked fine. But
-- request_return() reads return_window_days into a variable, gets NULL, and
-- `now() > <timestamp> + make_interval(days => NULL)` evaluates to NULL — which
-- is not true, so the IF does not fire and the window check passes. A missing
-- row meant an unlimited returns window, silently, with no error anywhere.
--
-- Seeded here, and request_return() is changed below to refuse to run rather
-- than assume, so the same class of mistake cannot come back through a restored
-- database or a fresh environment.

insert into store_settings (
  id,
  free_delivery_threshold_pence,
  return_window_days,
  collection_fee_pence,
  vat_rate_basis_points,
  contact_email,
  from_email,
  maintenance_mode
) values (
  true,
  15000,   -- £150. §5 — CONFIRM before launch, this is the spec's figure, not a decision.
  30,      -- PLACEHOLDER. UK distance selling gives 14 days minimum; 30 is a common
           -- retail choice. The published policy has not been legally reviewed yet.
  0,
  2000,    -- 20% UK VAT
  'hello@metheues.com',       -- PLACEHOLDER: domain not yet confirmed
  'orders@metheues.com',      -- PLACEHOLDER: must be a domain verified in Resend
  false
)
on conflict (id) do nothing;

-- Refuse rather than assume. A NULL window is not "no limit", it is a
-- misconfigured store, and the customer should not find that out by being
-- allowed to return a shirt from last year.
create or replace function request_return(
  p_order_id      uuid,
  p_items         jsonb,
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
  if v_window_days is null then
    raise exception 'store_settings.return_window_days is not configured';
  end if;

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
    if not exists (
      select 1 from order_items oi
       where oi.id = v_item.order_item_id
         and oi.order_id = v_order.id
    ) then
      raise exception 'Item does not belong to order %', v_order.order_number;
    end if;

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

  return query select v_return_id, v_return_no;
end;
$$;

revoke execute on function request_return(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function request_return(uuid, jsonb, text) to service_role;
