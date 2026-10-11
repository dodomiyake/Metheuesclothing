-- Metheues Clothings — the customer list A19/A20 need, and the one RLS gap
-- that stopped A20 showing saved addresses.
--
-- WHY A FUNCTION AND NOT A QUERY. "Customers" is not a table in this schema
-- and never was. A customer is either a `profiles` row or an email that has
-- placed an order without one (orders.profile_id is null for a guest —
-- 001_schema.sql:152), and the screen's five data columns (orders, spent,
-- last order, country, account) are an aggregate over `orders` grouped by
-- email. PostgREST cannot express a GROUP BY, a UNION or a window function,
-- so the only alternative was to pull every order into the page and reduce
-- it in JavaScript — which makes search, sort and pagination lies the
-- moment the shop has more orders than one page can hold.
--
-- WHY IT HAS TO BE SECURITY DEFINER. The ACCOUNT column is Verified /
-- Unverified / Guest, and nothing in `public` records whether an email was
-- confirmed: that is auth.users.email_confirmed_at, which Supabase does not
-- expose to the `authenticated` role at all. A definer function owned by
-- postgres can read it; a view with security_invoker cannot. Narrowing the
-- column to Registered / Guest was the alternative and it would have been
-- hiding data we actually hold.
--
-- Rule 3 applies unchanged: revoked from public, anon and authenticated,
-- granted to service_role only. That means these are called with the
-- service client, so the two pages that call them do their OWN staff check
-- rather than trusting the admin layout to have run (lib/admin/require-staff.ts).
-- is_staff() is no use inside the function itself — service_role has no
-- auth.uid() — so the check has to live in front of it.
--
-- EMAIL IS THE IDENTITY, and it is lowercased everywhere here. The columns
-- are citext so the database already matches case-insensitively, but the
-- UNION below is over text, and 'Jordan@x.com' on an order beside
-- 'jordan@x.com' on a profile would otherwise split one person into two
-- rows — one "guest" with the orders and one "verified" with none. That is
-- exactly the failure the design's own footer warns about: guests are
-- matched by email so their orders still group together.

-- --------------------------------------------------------------- the list
create or replace function admin_customers(
  p_search  text    default null,
  p_type    text    default null,   -- registered | guest | verified | unverified
  p_country text    default null,   -- ISO2, from the latest order's snapshot
  p_sort    text    default 'recent',
  p_limit   integer default 25,
  p_offset  integer default 0
)
returns table (
  email         text,
  profile_id    uuid,
  full_name     text,
  account       text,
  order_count   bigint,
  spent_pence   bigint,
  last_order_at timestamptz,
  country_code  text,
  total_count   bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
with paid as (
  -- ORDERS and SPENT count orders that were actually paid for. A `pending`
  -- order is an abandoned checkout; counting it would show "3 orders,
  -- GBP 0.00" against someone who has bought nothing. Refunded orders DO
  -- count, and the figure is not net of refunds -- it is lifetime spend,
  -- the sum of what was charged, which is what reconciles with the order
  -- list on A20. (A02's "net of refunds" revenue figure is a different
  -- question answered a different way.)
  select lower(o.email::text)                                            as email,
         o.total_pence,
         o.placed_at,
         upper(o.delivery_address->'address'->>'country')                as country_code,
         nullif(btrim(coalesce(o.delivery_address->>'name', '')), '')    as snapshot_name
    from orders o
   where o.payment_status in ('paid', 'partially_refunded', 'refunded')
),
agg as (
  select email,
         count(*)::bigint                                                as order_count,
         sum(total_pence)::bigint                                        as spent_pence,
         max(placed_at)                                                  as last_order_at,
         (array_agg(country_code  order by placed_at desc)
            filter (where country_code  is not null))[1]                 as country_code,
         (array_agg(snapshot_name order by placed_at desc)
            filter (where snapshot_name is not null))[1]                 as snapshot_name
    from paid
   group by email
),
people as (
  select e.email                                                         as email,
         p.id                                                            as profile_id,
         -- The profile's own name first; a guest has only what Stripe put
         -- in the delivery snapshot, and that is better than a blank cell.
         coalesce(nullif(btrim(coalesce(p.full_name, '')), ''),
                  a.snapshot_name)                                       as full_name,
         case when p.id is null                     then 'guest'
              when u.email_confirmed_at is not null then 'verified'
              else                                       'unverified'
         end                                                             as account,
         coalesce(a.order_count, 0)                                      as order_count,
         coalesce(a.spent_pence, 0)                                      as spent_pence,
         a.last_order_at                                                 as last_order_at,
         a.country_code                                                  as country_code
    from (select email from agg
          union
          select lower(email::text) from profiles) e
    left join profiles   p on p.email = e.email::citext
    left join auth.users u on u.id    = p.id
    left join agg        a on a.email = e.email
   -- A staff or owner account is only a CUSTOMER once it has ordered.
   -- Without this the shop's own staff sit at the top of the list with
   -- nothing against their name.
   where p.id is null or p.role = 'customer' or a.email is not null
),
filtered as (
  select people.*, count(*) over () as total_count
    from people
   where (p_search is null or btrim(p_search) = ''
          or email                       ilike '%' || btrim(p_search) || '%'
          or coalesce(full_name, '')     ilike '%' || btrim(p_search) || '%')
     and (p_type is null or p_type = ''
          or (p_type = 'registered' and profile_id is not null)
          or (p_type = 'guest'      and profile_id is null)
          or (p_type in ('verified', 'unverified') and account = p_type))
     and (p_country is null or p_country = '' or country_code = upper(p_country))
)
select email, profile_id, full_name, account, order_count, spent_pence,
       last_order_at, country_code, total_count
  from filtered
 -- One ORDER BY, four sorts. Every CASE but the chosen one evaluates to
 -- NULL for every row, so it contributes nothing to the ordering.
 order by
   case when p_sort = 'spent'  then spent_pence end desc nulls last,
   case when p_sort = 'orders' then order_count end desc nulls last,
   case when p_sort = 'name'   then lower(coalesce(full_name, email)) end asc nulls last,
   case when coalesce(p_sort, 'recent') not in ('spent', 'orders', 'name')
        then last_order_at end desc nulls last,
   email
 limit  greatest(1, least(coalesce(p_limit, 25), 200))
offset greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function admin_customers(text, text, text, text, integer, integer)
  from public, anon, authenticated;
grant  execute on function admin_customers(text, text, text, text, integer, integer)
  to service_role;

-- ------------------------------------------------------------- one person
-- Everything A20 shows that a staff session cannot read for itself: the
-- verification and last-sign-in facts from auth.users, and the newsletter
-- row (newsletter_subscribers has an INSERT policy and no SELECT policy --
-- 002_rls.sql:107 -- so it is invisible even to staff).
--
-- Always returns exactly one row, including for an email nobody has ever
-- used, so the page renders "no account" rather than 404ing on a customer
-- whose orders it is about to list.
create or replace function admin_customer_account(p_email text)
returns table (
  email                      text,
  profile_id                 uuid,
  full_name                  text,
  phone                      text,
  account                    text,
  profile_created_at         timestamptz,
  email_confirmed_at         timestamptz,
  last_sign_in_at            timestamptz,
  marketing_opt_in           boolean,
  marketing_opt_in_at        timestamptz,
  newsletter_consent_at      timestamptz,
  newsletter_unsubscribed_at timestamptz
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select lower(k.e::text),
         p.id,
         nullif(btrim(coalesce(p.full_name, '')), ''),
         nullif(btrim(coalesce(p.phone, '')), ''),
         case when p.id is null                     then 'guest'
              when u.email_confirmed_at is not null then 'verified'
              else                                       'unverified'
         end,
         p.created_at,
         u.email_confirmed_at,
         u.last_sign_in_at,
         p.marketing_opt_in,
         p.marketing_opt_in_at,
         n.consent_at,
         n.unsubscribed_at
    from (select lower(btrim(p_email))::citext as e) k
    left join profiles               p on p.email = k.e
    left join auth.users             u on u.id    = p.id
    left join newsletter_subscribers n on n.email = k.e;
$$;

revoke execute on function admin_customer_account(text) from public, anon, authenticated;
grant  execute on function admin_customer_account(text) to service_role;

-- ------------------------------------------------------------------- RLS
-- `addresses_own` (002_rls.sql:51) is `for all using (profile_id =
-- auth.uid())` and is the only customer-owned table with no `or is_staff()`
-- anywhere -- orders, returns, order_items, payments, fulfilments and
-- profiles all have one. Staff already see a delivery address on every
-- order they open; a saved address is the same class of data, and A20 draws
-- a SAVED ADDRESSES card that could not be filled without this. Additive:
-- the existing policy is untouched, and a SELECT policy ORs with it.
create policy addresses_staff_read on addresses
  for select using (is_staff());
