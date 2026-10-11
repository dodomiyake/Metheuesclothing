-- A18's three actions: mark received, approve or reject, refund.
--
-- Split from 013 because they are the behaviour and 013 is the shape, and
-- because this file applied as its own migration -- see the note on
-- refund_return at the bottom for why record_refund could not simply gain a
-- parameter.

-- ------------------------------------------------------------- receiving
-- A18's progress list has a "Checked at the atelier" step and its Refund
-- panel says "available once the parcel is marked received and checked" --
-- but nothing in this codebase could ever set that state, so without this
-- no return could be approved at all.
create or replace function receive_return(
  p_return_id   uuid,
  p_actor       uuid default null,
  p_actor_label text default 'Staff'
)
returns return_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status return_status;
  v_number text;
begin
  select status, return_number into v_status, v_number
  from returns where id = p_return_id
  for update;

  if not found then
    raise exception 'receive_return: no such return';
  end if;

  if v_status in ('approved', 'rejected', 'refunded') then
    raise exception 'receive_return: return % has already been decided (%)', v_number, v_status;
  end if;

  if v_status = 'received' then
    raise exception 'receive_return: return % is already marked received', v_number;
  end if;

  update returns set status = 'received', received_at = now() where id = p_return_id;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (p_actor, p_actor_label, 'return_received', 'return', p_return_id::text,
          'Marked return ' || v_number || ' received');

  return 'received';
end;
$$;

revoke execute on function receive_return(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function receive_return(uuid, uuid, text) to service_role;

-- -------------------------------------------------------------- deciding
-- A18's Approve and Reject. One function because approving is four writes --
-- the return row, every return_item's condition and restock flag, the stock
-- itself, and the audit entry -- and doing that from a route leaves a return
-- marked approved with the goods never put back (rule 4).
--
-- APPROVING MOVES NO MONEY. The design says so in the Decision panel and it
-- is worth keeping exactly: "Approving does not move any money. It confirms
-- the return is accepted, records the condition, and applies the restock
-- choices above. The refund is a separate, deliberate step."
--
-- IT ALSO REQUIRES THE PARCEL TO BE HERE, which is a departure from the
-- frames and the one place A18 contradicts itself. The top bar draws Approve
-- as enabled while the status badge still reads "On its way to us" -- but
-- approval applies the restock, and putting stock back for a parcel nobody
-- has opened is how the shop sells a T-shirt that is still in a Royal Mail
-- van. The design's own condition select offers "Not checked yet", which is
-- an answer for a parcel that has not arrived; recording it and restocking
-- on the strength of it are different things. Refusing here is also what the
-- Refund panel already implies ("available once the parcel is marked
-- received and checked"). Raise it with the design owner.
create or replace function decide_return(
  p_return_id   uuid,
  p_approve     boolean,
  p_reason      text default null,
  -- [{return_item_id, condition, restock}] -- per item, per A18.
  p_items       jsonb default '[]'::jsonb,
  p_actor       uuid default null,
  p_actor_label text default 'Staff'
)
returns return_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status   return_status;
  v_number   text;
  v_item     record;
  v_units    integer := 0;
  v_lines    integer := 0;
begin
  select status, return_number into v_status, v_number
  from returns where id = p_return_id
  for update;

  if not found then
    raise exception 'decide_return: no such return';
  end if;

  if v_status in ('approved', 'rejected', 'refunded') then
    raise exception 'decide_return: return % has already been decided (%)', v_number, v_status;
  end if;

  if not p_approve and btrim(coalesce(p_reason, '')) = '' then
    -- E9 "states the specific finding" and A18 says the reason is emailed to
    -- the customer in plain language, so there has to be one.
    raise exception 'decide_return: a reason is required to reject a return';
  end if;

  if p_approve and v_status <> 'received' then
    raise exception 'decide_return: return % is % -- mark it received before approving, because approving puts stock back', v_number, v_status;
  end if;

  -- Condition is recorded either way: a rejection's finding is the evidence
  -- behind it, and E9 quotes it.
  for v_item in
    select (e->>'return_item_id')::uuid as id,
            e->>'condition'             as condition,
           coalesce((e->>'restock')::boolean, false) as restock
    from jsonb_array_elements(p_items) e
  loop
    update return_items
       set condition = nullif(btrim(coalesce(v_item.condition, '')), ''),
           -- A rejected return never restocks, whatever the form said.
           restock   = (p_approve and v_item.restock)
     where id = v_item.id and return_id = p_return_id;

    if not found then
      raise exception 'decide_return: item does not belong to return %', v_number;
    end if;
  end loop;

  if p_approve then
    -- Per item, not per order. order_id stays null so the whole-order
    -- exactly-once index is untouched -- see this file's header.
    for v_item in
      select ri.id, ri.quantity, oi.variant_id
        from return_items ri
        join order_items oi on oi.id = ri.order_item_id
       where ri.return_id = p_return_id and ri.restock and oi.variant_id is not null
    loop
      insert into inventory_adjustments (variant_id, delta, kind, reason, return_item_id, actor_id)
      values (v_item.variant_id, v_item.quantity, 'return_restock',
              'Return ' || v_number || ' approved', v_item.id, p_actor)
      on conflict (return_item_id, kind) where return_item_id is not null do nothing;

      if found then
        update product_variants
           set stock_quantity = stock_quantity + v_item.quantity
         where id = v_item.variant_id;
        v_units := v_units + v_item.quantity;
        v_lines := v_lines + 1;
      end if;
    end loop;
  end if;

  update returns
     set status          = case when p_approve then 'approved'::return_status else 'rejected'::return_status end,
         decided_at      = now(),
         decision_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_return_id;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    p_actor_label,
    case when p_approve then 'return_approved' else 'return_rejected' end,
    'return',
    p_return_id::text,
    case when p_approve
         then 'Approved return ' || v_number || ' - ' || v_lines || ' line(s), ' || v_units || ' unit(s) restocked - no money moved'
         else 'Rejected return ' || v_number || ' - ' || btrim(p_reason) end
  );

  return case when p_approve then 'approved'::return_status else 'rejected'::return_status end;
end;
$$;

revoke execute on function decide_return(uuid, boolean, text, jsonb, uuid, text)
  from public, anon, authenticated;
grant  execute on function decide_return(uuid, boolean, text, jsonb, uuid, text)
  to service_role;

-- --------------------------------------------------------------- refunds
-- The refund that settles a return.
--
-- record_refund (012) is NOT given a p_return_id, and that is a tooling
-- constraint rather than a design choice: adding a parameter changes a
-- function's identity, so it would need DROP first or PostgREST ends up with
-- two overloads it cannot choose between -- and this environment's Supabase
-- tooling gates DROP behind a confirmation that never arrives (see
-- supabase/cleanup-zz-test-fixture.sql for the same wall). Wrapping is the
-- better shape anyway: the money logic -- the over-refund sum, the
-- paid/partially_refunded transitions, the audit row -- stays in ONE place
-- rather than being copied into a second function that would drift.
--
-- It deliberately passes p_restock => false. A18 owns the restock decision,
-- per item, at approval; running the whole-order restock here as well would
-- put the same goods back twice.
create or replace function refund_return(
  p_return_id        uuid,
  p_amount_pence     integer,
  p_reason           text,
  p_note             text default null,
  p_stripe_refund_id text default null,
  p_actor            uuid default null,
  p_actor_label      text default 'Staff'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_number   text;
  v_status   return_status;
  v_refund   uuid;
begin
  select order_id, return_number, status into v_order_id, v_number, v_status
  from returns where id = p_return_id
  for update;

  if not found then
    raise exception 'refund_return: no such return';
  end if;

  if v_status <> 'approved' then
    raise exception 'refund_return: return % is % -- approve it before refunding', v_number, v_status;
  end if;

  perform record_refund(
    v_order_id, p_amount_pence, p_reason,
    false,
    p_note, p_stripe_refund_id, p_actor, p_actor_label
  );

  -- Identified by the Stripe refund id, which is unique where present; the
  -- newest row for the order is the fallback for a refund that moved outside
  -- Stripe.
  select id into v_refund
  from refunds
  where order_id = v_order_id
    and (p_stripe_refund_id is null or stripe_refund_id = p_stripe_refund_id)
  order by created_at desc
  limit 1;

  update refunds set return_id = p_return_id where id = v_refund;

  update returns
     set status = 'refunded',
         refund_pence = coalesce(refund_pence, 0) + p_amount_pence
   where id = p_return_id;

  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (p_actor, p_actor_label, 'return_refunded', 'return', p_return_id::text,
          'Refunded GBP ' || to_char(p_amount_pence / 100.0, 'FM999999990.00')
            || ' for return ' || v_number || ' - ' || btrim(p_reason));

  return v_refund;
end;
$$;

revoke execute on function refund_return(uuid, integer, text, text, text, uuid, text)
  from public, anon, authenticated;
grant  execute on function refund_return(uuid, integer, text, text, text, uuid, text)
  to service_role;
