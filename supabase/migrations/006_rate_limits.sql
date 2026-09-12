-- Rate limiting, in the database rather than in memory.
--
-- The obvious implementation — a Map in the Node process — is wrong here. The
-- app runs serverless, so there is no single process: each request may land on
-- a cold instance with an empty Map, and an attacker gets the full allowance
-- again on every one. The limit has to live where the state is shared, and the
-- only shared thing is Postgres.

create table rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on rate_limits (window_start);

alter table rate_limits enable row level security;
-- No policy is defined on purpose. With RLS on and no policy, anon and
-- authenticated can read and write nothing at all; only the service role, which
-- bypasses RLS, can touch it. A customer must not be able to read the table
-- that decides whether to let them through, nor delete their own counter.

-- Returns true if this hit is allowed, false if the caller is over the limit.
--
-- The counting is done by INSERT ... ON CONFLICT DO UPDATE ... RETURNING, which
-- is a single atomic statement. Reading the count and then writing it back would
-- let two simultaneous requests both read 4, both write 5, and both be allowed
-- past a limit of 5.
create or replace function rate_limit_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  -- Fixed window, aligned to the epoch so every instance agrees on where the
  -- boundary is without coordinating.
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
    do update set hits = rate_limits.hits + 1
  returning hits into v_hits;

  -- Sweep old windows occasionally rather than on every call. Doing it every
  -- time would put a delete in the hot path of every rate-limited request.
  if random() < 0.005 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- §12, and the rule this codebase learned the hard way in 004: a SECURITY
-- DEFINER function is callable over /rest/v1/rpc/ by anyone unless EXECUTE is
-- explicitly revoked. Without this, anon could call rate_limit_hit with a
-- guessed key and a p_limit of 0 to lock a real customer out, or with a huge
-- p_limit to wave themselves through.
revoke execute on function rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function rate_limit_hit(text, integer, integer)
  to service_role;
