-- Metheues Clothings — migration 023
-- erase_customer(): the UK GDPR erasure right, done the only way six-year
-- tax retention allows.
--
-- `docs/legal/privacy.md` and the /privacy page both promise this:
--
--   "We cannot delete the record of a completed order, because tax law
--    requires us to keep it. What we can do is disconnect it from you:
--    remove your profile, your saved addresses and your contact details,
--    leaving the sale itself as an anonymous entry in the books."
--
-- Until now that was done "by hand on request" — which is to say, not at
-- all, because nobody had written down what by hand would even mean. A20's
-- Data requests card has carried the gap since the screen was built.
--
-- ============================================================ A20 WAS RIGHT
-- AND THE DATABASE IS STRICTER THAN IT KNEW
--
-- A20's note said a careless `delete from profiles` would cascade to
-- addresses and null `orders.profile_id`, quietly turning a sales history
-- into guest orders. True, and it stops short of the real finding:
--
--   THE DELETE WOULD NOT SUCCEED AT ALL for most customers.
--
-- `audit_logs.actor_id references profiles(id)` with no ON DELETE clause,
-- so it is NO ACTION — verified against pg_constraint on the live database
-- (confdeltype 'a'). Migration 021 made request_return() write an audit row
-- naming the customer who raised the return, so any customer who has ever
-- asked to return something is referenced by an audit row. And audit_logs
-- is append-only, enforced by the forbid_audit_mutation triggers, so that
-- reference can never be updated away either.
--
-- Two of the three profiles on the live database are already in that state.
--
-- The consequence reaches further than this function: `profiles.id
-- references auth.users(id) on delete cascade`, so deleting the AUTH user
-- cascades into profiles and hits the same restriction. Supabase's own
-- "Delete user" button in the dashboard would fail with a foreign key
-- error for those customers. Nobody knew that, and finding out during a
-- one-month statutory deadline is the wrong time.
--
-- SO ERASURE IS ANONYMISATION IN PLACE, not deletion, and that is not a
-- workaround — it is what the policy already describes and what the law
-- and HMRC together actually require. The row stays; the person leaves it.
--
-- ============================================================ THE TOMBSTONE
-- One random address per erasure, shared by the profile and every one of
-- their orders: 'erased-<uuid>@erased.invalid'.
--
-- `.invalid` is reserved by RFC 2606 and can never be a real mailbox, which
-- is the same reasoning behind the admin test account's `.test` address —
-- nothing can ever be delivered there and nobody can ever claim it.
--
-- ONE tombstone rather than one per row, because `admin_customers()`
-- aggregates by email: a per-order tombstone would shatter one person's
-- five orders into five one-order "customers" and the whole-shop figures on
-- A02 and A19 would stop reconciling. Shared, the erased person stays one
-- anonymous row holding the right orders and the right lifetime spend.
--
-- THE ROUTE MINTS IT AND PASSES IT IN, which is the one place this function
-- takes something from its caller rather than deriving it. The reason is
-- the ordering: the auth identity has to be anonymised BEFORE the database
-- (see the route's note), and both halves have to end up holding the same
-- address or the account and its orders are two different anonymous people.
-- A caller-supplied value is a caller-supplied place to write, so the shape
-- is checked here rather than trusted -- the same call /sign makes about a
-- storage path.
--
-- ============================================================ WHAT STAYS
-- Deliberately not touched, each for its own reason:
--
--  * ORDER TOTALS, LINES, PAYMENTS AND REFUNDS. The sale is the record tax
--    law requires. order_items hold a product/sku/colour/size snapshot and
--    no personal data.
--
--  * THE DELIVERY COUNTRY. Everything else in the address snapshot goes;
--    the country stays, because place of supply decides the VAT treatment
--    and A11's country filter reads
--    `delivery_address->address->>country`. A VAT record that cannot say
--    which country it was a supply to is not a VAT record.
--
--  * AUDIT ROWS. Append-only is the one property that log exists to have,
--    and dropping the triggers to tidy up a name would defeat it — the same
--    call this project already made about the four ZZ-TEST rows. Entries
--    identify a person by NAME and by an order or return number, never by
--    email address, which is exactly why 021 chose the name over the
--    address. /privacy says so in terms.
--
--  * payments.card_last4. Four digits cannot charge a card or identify a
--    person on their own, and it is part of the payment record. Stripe
--    holds the rest and is a controller in its own right; erasure there is
--    a separate request to a separate processor, which /privacy discloses.
--
-- AND WHAT THIS FUNCTION CANNOT REACH: the auth identity. auth.users holds
-- the email the customer signs in with, and this function deliberately does
-- not touch the auth schema — sessions, identities and refresh tokens are
-- GoTrue's to manage, and hand-editing them from SQL is how you get an
-- account that is half deleted. The route calls the Auth Admin API first,
-- then this. See the route's own ordering note.
--
-- ============================================================ TWO REFUSALS
-- 1. STAFF AND OWNERS ARE NOT ERASABLE HERE. Their profile is named by
--    audit rows as an ACTOR, and the admin account signing in is one row's
--    role column. An employment record is a different question from a
--    customer's erasure right, and conflating them in a one-click dialog is
--    how someone erases their own access.
--
-- 2. AN ORDER STILL NEEDING ITS ADDRESS BLOCKS ERASURE. A paid order that
--    is not yet delivered or cancelled needs somewhere to go; UK GDPR lets
--    us hold the data while it is necessary to perform the contract. The
--    refusal names the order numbers so staff can finish or cancel them
--    rather than guessing which one is in the way.
--
-- Rule 3 applies: revoked from public, anon and authenticated, granted to
-- service_role only. The route is what checks the caller is an OWNER.

create or replace function erase_customer(
  p_email text,
  p_tombstone text,
  p_reason text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email      citext;
  v_profile    uuid;
  v_role       actor_role;
  v_tombstone  citext;
  v_order_ids  uuid[];
  v_blocking   text;
  v_orders     integer := 0;
  v_returns    integer := 0;
  v_addresses  integer := 0;
  v_subs       integer := 0;
  v_label      text;
  v_reason     text;
begin
  v_email := lower(btrim(coalesce(p_email, '')))::citext;

  if v_email = '' then
    raise exception 'An email address is required.';
  end if;

  -- Erasing a tombstone would mint a second one and make the books show two
  -- anonymous customers where there was one.
  if v_email like 'erased-%@erased.invalid' then
    raise exception 'That address is already an erasure tombstone - this customer has been erased.';
  end if;

  -- A20's dialog asks why, the way A15 and A16 do. It is stored in the
  -- audit summary rather than discarded: a reason collected and dropped is
  -- the shape of field this project keeps refusing, and this is the one
  -- action where "who asked for this, and when" is the whole defence.
  v_reason := btrim(coalesce(p_reason, ''));
  if v_reason = '' then
    raise exception 'A reason is required.';
  end if;

  v_tombstone := lower(btrim(coalesce(p_tombstone, '')))::citext;

  if v_tombstone !~ '^erased-[0-9a-f-]{36}@erased\.invalid$' then
    raise exception 'The tombstone address is not the right shape.';
  end if;

  select id, role into v_profile, v_role from profiles where email = v_email;

  if v_profile is not null and v_role <> 'customer' then
    raise exception 'That account is % and cannot be erased from here. Change the role first, deliberately.', v_role;
  end if;

  select coalesce(array_agg(id), '{}') into v_order_ids
  from orders
  where email = v_email
     or (v_profile is not null and profile_id = v_profile);

  select count(*) into v_subs from newsletter_subscribers where email = v_email;

  -- Nothing held means nothing to erase, and saying so is better than
  -- reporting a successful erasure of an address we never had.
  if v_profile is null and cardinality(v_order_ids) = 0 and v_subs = 0 then
    raise exception 'We hold nothing against that address.';
  end if;

  -- Refusal 2. The address is still needed to perform the contract.
  select string_agg(order_number, ', ' order by placed_at)
    into v_blocking
  from orders
  where id = any(v_order_ids)
    and payment_status in ('paid', 'partially_refunded')
    and fulfilment_status in ('not_started', 'processing', 'packed', 'shipped');

  if v_blocking is not null then
    raise exception 'Cannot erase yet - % still needs the delivery address. Mark it delivered or cancel it first.', v_blocking;
  end if;

  -- The address book is pure contact data. The order's own snapshot is the
  -- shipping record, and it is redacted below rather than deleted.
  delete from addresses where profile_id = v_profile;
  get diagnostics v_addresses = row_count;

  -- The customer's own words about why they sent something back. A18 has
  -- shown them to staff already; keeping them is keeping a free-text field
  -- that can name anybody.
  update returns
     set customer_note = null
   where order_id = any(v_order_ids)
     and customer_note is not null;
  get diagnostics v_returns = row_count;

  update orders
     set email = v_tombstone,
         customer_note = null,
         billing_address = null,
         delivery_address = jsonb_build_object(
           'erased', true,
           'name', null,
           'address', jsonb_build_object(
             'line1', null,
             'line2', null,
             'city', null,
             'state', null,
             'postal_code', null,
             -- kept: place of supply decides the VAT treatment
             'country', delivery_address -> 'address' ->> 'country'
           )
         )
   where id = any(v_order_ids);
  get diagnostics v_orders = row_count;

  if v_profile is not null then
    update profiles
       set email = v_tombstone,
           full_name = null,
           phone = null,
           marketing_opt_in = false,
           marketing_opt_in_at = null
     where id = v_profile;
  end if;

  -- No suppression list exists to add them to, and there is nothing to
  -- suppress: the address is gone from every table, so a future sign-up
  -- would be a fresh consent rather than a resurrected one.
  delete from newsletter_subscribers where email = v_email;

  select coalesce(full_name, email::text) into v_label from profiles where id = p_actor;

  -- THE SUMMARY MUST NOT NAME THE ERASED ADDRESS. audit_logs cannot be
  -- edited or deleted by anyone, so an email written here would be the one
  -- copy erasure could never reach — the log would defeat the act it is
  -- recording. It names the tombstone, which is what A19 and A20 now show
  -- for this person, and the counts.
  insert into audit_logs (actor_id, actor_label, action, entity_type, entity_id, summary)
  values (
    p_actor,
    coalesce(v_label, 'Owner'),
    'customer_erased',
    'customer',
    v_tombstone::text,
    'Customer erased on request. '
      || v_orders || ' order' || case when v_orders = 1 then '' else 's' end || ' anonymised, '
      || v_addresses || ' saved address' || case when v_addresses = 1 then '' else 'es' end || ' deleted, '
      || v_returns || ' return note' || case when v_returns = 1 then '' else 's' end || ' cleared, '
      || case when v_subs > 0 then 'removed from the mailing list, ' else 'not on the mailing list, ' end
      || case when v_profile is null then 'no account held' else 'profile anonymised' end
      || '. Reason: ' || v_reason
      || '. Sales records stand under ' || v_tombstone::text || '.'
  );

  return jsonb_build_object(
    'tombstone', v_tombstone::text,
    'profile_erased', v_profile is not null,
    'orders_anonymised', v_orders,
    'addresses_deleted', v_addresses,
    'return_notes_cleared', v_returns,
    'newsletter_removed', v_subs > 0
  );
end;
$$;

revoke execute on function erase_customer(text, text, text, uuid)
  from public, anon, authenticated;
grant  execute on function erase_customer(text, text, text, uuid)
  to service_role;
