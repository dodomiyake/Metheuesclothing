-- Metheues Clothings — lock down SECURITY DEFINER functions
--
-- WHY THIS EXISTS: 001–003 shipped a real hole. Postgres grants EXECUTE on new
-- functions to PUBLIC by default, and Supabase exposes every public function at
-- /rest/v1/rpc/<name>. Because decrement_stock_for_order and restock_for_order
-- are SECURITY DEFINER, anyone on the internet could have called them with an
-- order id and moved stock. Supabase's security advisor caught it.
--
-- Rule to carry forward: every SECURITY DEFINER function needs an explicit
-- REVOKE unless you intend the whole internet to call it.

revoke execute on function decrement_stock_for_order(uuid) from public, anon, authenticated;
revoke execute on function restock_for_order(uuid, adjustment_kind, text, uuid) from public, anon, authenticated;
revoke execute on function price_cart(jsonb) from public, anon, authenticated;

grant execute on function decrement_stock_for_order(uuid) to service_role;
grant execute on function restock_for_order(uuid, adjustment_kind, text, uuid) to service_role;
grant execute on function price_cart(jsonb) to service_role;

-- is_staff() and is_owner() KEEP execute for authenticated. RLS policy
-- expressions are evaluated as the calling role, so revoking here breaks every
-- staff policy. They only report on the caller's own role, which the caller
-- already knows, so exposing them over RPC leaks nothing.

-- Pin search_path on the trigger functions, so a caller cannot set a
-- search_path that resolves now() or a table name to something of their own.
create or replace function forbid_audit_mutation()
returns trigger language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;
