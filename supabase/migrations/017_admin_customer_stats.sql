-- The two figures A19's subtitle states: "318 people · 41 have ordered more
-- than once" (143:2545).
--
-- Separate from admin_customers() rather than folded into it, because 016 is
-- already applied and migrations here are never edited once they have run
-- (CLAUDE.md conventions) -- and because the two questions are genuinely
-- different. admin_customers() answers "who is on this page of this filtered
-- list"; its total_count is the size of the FILTERED set, which is the right
-- number for pagination and the wrong one for a subtitle that is supposed to
-- describe the whole shop. Counting repeat buyers from a page would be worse
-- still: it would report whatever that page happened to contain.
--
-- Guests are counted too. The footer tells staff that guests are matched by
-- email and cannot sign in, and how many there are is the first thing anyone
-- reads that sentence wanting to know.
--
-- The `people` set is defined exactly as admin_customers defines it, down to
-- the lower() and the staff-who-have-never-ordered exclusion, so the two
-- cannot disagree about how many customers exist.
create or replace function admin_customer_stats()
returns table (people bigint, repeat_buyers bigint, guests bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
with agg as (
  select lower(o.email::text) as email, count(*)::bigint as order_count
    from orders o
   where o.payment_status in ('paid', 'partially_refunded', 'refunded')
   group by lower(o.email::text)
),
people as (
  select e.email, p.id as profile_id, coalesce(a.order_count, 0) as order_count
    from (select email from agg
          union
          select lower(email::text) from profiles) e
    left join profiles p on p.email = e.email::citext
    left join agg      a on a.email = e.email
   where p.id is null or p.role = 'customer' or a.email is not null
)
select count(*)::bigint,
       count(*) filter (where order_count > 1)::bigint,
       count(*) filter (where profile_id is null)::bigint
  from people;
$$;

revoke execute on function admin_customer_stats() from public, anon, authenticated;
grant  execute on function admin_customer_stats() to service_role;
