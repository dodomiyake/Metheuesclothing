-- profiles never gets a row created for it.
--
-- auth.users gets one automatically on sign-up (that's Supabase Auth's own
-- table), but nothing has ever inserted the matching public.profiles row.
-- This is the same class of mistake as store_settings having no row (008):
-- a table nothing populates, RLS quietly returns zero rows instead of
-- raising, and it reads as "no data yet" rather than "broken". Here it would
-- have meant every signed-in customer failing profiles_self_read, unable to
-- save an address (addresses.profile_id references profiles), and unable to
-- check out with an account rather than as a guest.
--
-- SECURITY DEFINER because profiles deliberately has no INSERT policy for
-- authenticated (002_rls.sql) — a customer must never be able to insert an
-- arbitrary profile row for themselves with a role of their choosing. This
-- trigger is the one exception, and it only ever writes role = 'customer'
-- (the column default; nothing here can set staff or owner).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Nothing should ever call this directly — it only makes sense fired by the
-- trigger below, where NEW is bound to the row auth.users just inserted.
-- Revoked anyway, per 004's rule: Postgres grants EXECUTE on a new function
-- to PUBLIC by default, and Supabase exposes every public function over
-- /rest/v1/rpc/ regardless of whether it was meant to be called that way.
revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: any auth.users row that predates this trigger (there should not
-- be any in a fresh project, but this makes the migration correct either way)
-- gets its profiles row now, with the same on-conflict guard.
insert into profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
