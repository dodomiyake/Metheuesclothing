-- RUN THIS ONCE, THEN DELETE THIS FILE.
--
-- Migration 012 (cancel_order / record_refund) was exercised against the live
-- project because nothing in this codebase had ever been run against real
-- data. The checks all passed -- partial refund, the over-refund guard, the
-- full refund with restock, cancellation with restock, cancelling an unpaid
-- order, and the refusals for a shipped order, a blank reason, a zero amount
-- and a duplicate Stripe refund id.
--
-- The convention (CLAUDE.md) is to delete that data afterwards and confirm
-- the tables are back to zero. THAT COULD NOT BE DONE FROM THE SESSION THAT
-- CREATED IT: the Supabase MCP tooling gates DELETE behind an interactive
-- confirmation that never arrived, and both execute_sql and apply_migration
-- timed out on it -- including on a DELETE matching no rows at all, which is
-- what proved it was the gate rather than a lock or a bad predicate. Nothing
-- was removed, so the fixture is still there, intact and inert.
--
-- Every predicate below is pinned to the ZZ-TEST-012 prefix. NOTE that the
-- live database is no longer empty -- it holds 1 other product, 15 other
-- variants and 4 other orders that this session did not create and has not
-- touched. Do not widen these predicates.
--
-- Run it from the Supabase SQL editor.

begin;

-- Helper functions used only to capture the RAISE messages as rows.
drop function if exists zz_try_refund(integer, text, boolean, text);
drop function if exists zz_try_cancel(uuid, text, integer, text);

delete from inventory_adjustments
 where order_id in (select id from orders where order_number like 'ZZ-TEST-012-%');
delete from refunds
 where order_id in (select id from orders where order_number like 'ZZ-TEST-012-%');
delete from order_items
 where order_id in (select id from orders where order_number like 'ZZ-TEST-012-%');
delete from payments
 where order_id in (select id from orders where order_number like 'ZZ-TEST-012-%');
delete from orders where order_number like 'ZZ-TEST-012-%';
delete from product_variants where sku = 'ZZ-TEST-012-M';
delete from products where slug = 'zz-test-tee-012';

commit;

-- Expect 0, 0, 0, 0, 0, 0 -- and 4 for the audit rows, which stay.
select
  (select count(*) from products where slug = 'zz-test-tee-012')                as products,
  (select count(*) from product_variants where sku = 'ZZ-TEST-012-M')           as variants,
  (select count(*) from orders where order_number like 'ZZ-TEST-012-%')         as orders,
  (select count(*) from order_items where sku = 'ZZ-TEST-012-M')                as order_items,
  (select count(*) from payments where stripe_checkout_session_id like 'cs_zz_test_012_%') as payments,
  (select count(*) from refunds)                                                as refunds,
  (select count(*) from audit_logs where summary like '%ZZ-TEST-012%')          as audit_rows_kept;

-- THE FOUR audit_logs ROWS CANNOT BE DELETED AND SHOULD NOT BE. audit_logs is
-- append-only, enforced by the audit_logs_no_update / audit_logs_no_delete
-- triggers (003_functions.sql:162-165). Dropping those to tidy up four rows
-- would defeat the single property the log exists to have -- and the fact
-- that they cannot be removed is itself the best evidence the guarantee
-- holds. They all name ZZ-TEST-012-A or ZZ-TEST-012-B, so they are obvious
-- for what they are:
--
--   Refunded GBP 5.00 on order ZZ-TEST-012-A - Faulty or damaged on arrival - stock not restored
--   Refunded GBP 35.00 on order ZZ-TEST-012-A - Returned by the customer - 1 line(s) restocked
--   Cancelled order ZZ-TEST-012-B - Out of stock - GBP 40.00 refunded - 1 line(s) restocked
--   Cancelled order ZZ-TEST-012-D - Customer changed their mind - nothing to refund - 0 line(s) restocked
