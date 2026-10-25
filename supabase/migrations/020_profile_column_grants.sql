-- 020 — stop a customer editing their own `role`.
--
-- APPLIED 19 October 2026, by the owner through the dashboard SQL editor,
-- because this session's Supabase tooling refused every call with a
-- permission error. Only this status note has been edited since — every
-- statement below is byte-for-byte what ran, which is the thing the
-- never-edit-an-applied-migration convention exists to protect. The
-- grant itself is VERIFIED: column_privileges returns exactly these four
-- columns for `authenticated` and nothing for `anon`.
--
-- RE-RUN THROUGH THE TOOLING 25 October 2026, so the migration history
-- records it — it had been missing from `list_migrations` entirely, which
-- read 001-019 then 021. Safe because the file is only REVOKE and GRANT:
-- column_privileges was checked either side and is identical. It sorts
-- after 021 in the history, because versions are assigned at apply time;
-- see the README. The rule 3 advisor run this note said had not been seen
-- has now been done — the baseline is unchanged and `profiles` is not
-- flagged.
--
-- THE HOLE. profiles_self_write (002_rls.sql:48) is
--
--   for update using (id = auth.uid()) with check (id = auth.uid())
--
-- which is a ROW-level rule and says nothing about COLUMNS. `profiles`
-- holds `role`, and the publishable key is in the browser by design, so any
-- signed-in customer could call PostgREST directly:
--
--   supabase.from('profiles').update({ role: 'owner' }).eq('id', <self>)
--
-- and RLS would allow it, because the row genuinely is theirs. Being an
-- admin in this system is exactly one column on exactly that row (see the
-- note in CLAUDE.md about the dedicated admin account), so this is a
-- straight path from "customer" to the whole admin.
--
-- Nothing in this app ever did that — every route that writes profiles
-- parses with a `.strict()` schema that does not name `role`, which is the
-- reason those schemas are strict. But a route is not the lock. The lock
-- has to be in the database, because the database is what the browser can
-- reach without going through a route at all.
--
-- THE FIX is a column grant rather than another policy. PostgREST honours
-- table privileges, so revoking UPDATE and granting it back on named
-- columns means an update touching any other column is refused by Postgres
-- itself, for every caller holding the `authenticated` role, through any
-- client. `email` is deliberately NOT in the list: it must stay in step
-- with auth.users.email, and changing it belongs to Supabase Auth.
--
-- service_role is untouched and keeps full UPDATE, which is what the
-- dashboard and every SECURITY DEFINER function rely on.

revoke update on table profiles from authenticated;

grant update (full_name, phone, marketing_opt_in, marketing_opt_in_at)
  on table profiles to authenticated;

-- `anon` never had a policy allowing an update and does not need the grant;
-- revoked anyway so the privilege cannot outlive a future policy change.
revoke update on table profiles from anon;
