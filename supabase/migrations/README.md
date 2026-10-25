# Metheues Clothings — database

Twenty-one migrations implementing §10 of the MVP, written so the guarantees in
§18 are enforced by Postgres rather than by remembering to check.

**All twenty-one are applied to the live project** (`afzuhymegntqjwtdkmfb`,
eu-west-2). This file used to say there were three and that none had been
applied; both were true in September and neither has been since.

## The migrations

| File | What it does |
|---|---|
| `001_schema.sql` | Tables, constraints, indexes |
| `002_rls.sql` | Row level security |
| `003_functions.sql` | Stock, pricing and audit integrity |
| `004_lock_down_functions.sql` | `REVOKE EXECUTE` on 001–003's functions — see below |
| `005_reference_numbers.sql` | Order and return numbers from a sequence, not app code |
| `006_rate_limits.sql` | Rate limiting counted in Postgres |
| `007_request_return.sql` | `request_return()` — several inserts that must all happen |
| `008_store_settings_seed.sql` | The singleton row `store_settings` never had |
| `009_handle_new_user.sql` | The trigger that creates a `profiles` row on sign-up |
| `010_adjust_stock.sql` | `adjust_stock()`, the only way manual stock changes happen |
| `011_fulfilment.sql` | `advance_fulfilment()`, `ship_order()` |
| `012_cancel_and_refund.sql` | `cancel_order()`, `record_refund()`, and the `refunds` table |
| `013_return_links.sql` | `refunds.return_id`, `inventory_adjustments.return_item_id` |
| `014_return_actions.sql` | `receive_return()`, `decide_return()`, `refund_return()` |
| `015_audit_stock_adjustments.sql` | `adjust_stock()` writes an audit row |
| `016_admin_customers.sql` | `admin_customers()`, `admin_customer_account()`, `addresses_staff_read` |
| `017_admin_customer_stats.sql` | `admin_customer_stats()` |
| `018_delivery_rates.sql` | Delivery prices become columns instead of literals |
| `019_product_images_storage.sql` | The `shop-images` bucket, its policies, the position index |
| `020_profile_column_grants.sql` | Stops a customer editing their own `role` |
| `021_audit_return_requested.sql` | `request_return()` writes an audit row |

### 020 sits last in the migration history, and that is not a mistake

All twenty-one migrations are now recorded. 020 was first applied on 19 October
through the dashboard SQL editor rather than through the migration tooling, so
`supabase_migrations.schema_migrations` had a hole where it should have been —
the list ran 001–019, then 021. It was re-run through the tooling on 25 October
and the hole is closed.

VERSIONS ARE ASSIGNED WHEN A MIGRATION IS APPLIED, not read off the file name,
so 020's version is `20261025085615` and it sorts AFTER 021's `20261024223909`.
`list_migrations` therefore reads 001–019, 021, 020. Nothing is wrong with
that: the history records when each statement ran, and 020 genuinely ran
through the tooling last. Do not try to reorder it — the fix would mean editing
a history table to make it disagree with what happened.

Re-running was safe because the file is only REVOKE and GRANT, so it is a no-op
against grants already in place. Verified either side of the re-run against
`information_schema.column_privileges`: `authenticated` can UPDATE exactly
`full_name`, `marketing_opt_in`, `marketing_opt_in_at` and `phone` on
`profiles`, and `anon` has no UPDATE row at all. The rule 3 advisor run that
020 had never had from a session has now been done, and the baseline is
unchanged — `profiles` is not flagged by anything.

## The guarantees, and where they actually live

§18 lists things that must be true at launch. Most of them are easy to write in
application code and easy to lose in a refactor. They are in the database
instead.

**"Stock cannot become negative"** — `CHECK (stock_quantity >= 0)` on
`product_variants`. An oversell raises an exception. It does not clamp to zero.
A clamped count is a lie you discover at stock-take, when it is too late to
know which order caused it.

**"Stock decreases exactly once"** and **"duplicate webhook delivery cannot
decrease stock twice"** — a unique index on
`inventory_adjustments (order_id, variant_id, kind)`. The decrement function
inserts the adjustment first; a replayed Stripe event conflicts, inserts
nothing, and updates nothing. Calling it five times has the same effect as
calling it once. That is the whole trick, and it needs no lock.

013 added a SECOND exactly-once index rather than widening that one:
`inventory_adjustments (return_item_id, kind)`. Two partial returns on the same
order can both legitimately restock the same variant, and under the order-level
index the second would be silently swallowed. The order-level index must not be
weakened — it is what stops the replayed webhook.

**"One successful checkout creates exactly one durable order"** —
`webhook_events.stripe_event_id` is the primary key. Record the event before
doing the work. If the insert conflicts, you have already handled it: return
200 and stop. The handler deletes its claim row if the work then throws,
because a claim with no work behind it turns Stripe's retry into a silent
no-op.

**"The amount charged comes exclusively from server-authoritative data"** —
`price_cart(jsonb)` takes only variant IDs and quantities, which is all §12
permits the browser to send, and returns what those actually cost. Hand its
output to Stripe. Nothing in the request body can influence a price.

**"Administrators can be held to what they did"** — `audit_logs` has triggers
blocking UPDATE and DELETE. An audit trail the owner can edit is not an audit
trail. Note what that costs: an entry outlives its subject, and four rows
naming a deleted test fixture are still there because they cannot be removed.
That is the guarantee working, not a mess to tidy.

## Rule 3: every SECURITY DEFINER function needs an explicit REVOKE

004 exists because 001–003 shipped a real hole. Supabase exposes functions over
`/rest/v1/rpc/` and Postgres grants EXECUTE to `PUBLIC` on new functions, so
three integrity functions were callable by the public internet. The pattern,
applied to every one since:

```sql
revoke execute on function f(args) from public, anon, authenticated;
grant  execute on function f(args) to service_role;
```

There are nineteen SECURITY DEFINER functions. Seventeen are `service_role`
only. The two that are not — `is_staff()` and `is_owner()` — are deliberate,
and 004 says why: RLS policy expressions evaluate as the CALLING role, so
revoking EXECUTE on them breaks every staff policy in the database. They report
only on the caller's own role, which the caller already knows.

Run `get_advisors(type: "security")` after any migration that adds one. The
expected baseline is: `rate_limits` and `webhook_events` with RLS and no policy
(both are server-only tables), `citext` in the public schema, `is_staff` and
`is_owner` under both SECURITY DEFINER lints, and leaked-password protection
off. Anything else is new.

## Decisions worth knowing

**Money is integer pence.** £284.00 is `28400`. Never a float, never a decimal
that becomes a float on its way through JSON. This is the bug that surfaces as
a reconciliation that is three pence out and takes a day to find.

**Order items are snapshots.** `order_items` stores the product name, SKU,
colour, size and unit price as its own columns, not as a join. `variant_id` is
kept for reporting and nulls if the variant is deleted. This is what makes
archiving a product safe, and it is what the order screens and the confirmation
email both promise the customer.

**`orders` has a CHECK that the total adds up**, and `order_items` has one that
each line does. If a bug ever writes an inconsistent total, the insert fails
rather than quietly storing a number that does not match its parts.

**`product_images.alt_text` is NOT NULL.** §13 requires text alternatives.
A nullable column moves that rule into a code review, where it eventually gets
skipped on a busy day. Worth knowing what it cannot do: the one photograph in
the live database has lorem ipsum in that column. NOT NULL enforces that a
description exists, never that it describes.

**`inventory_adjustments.reason` is NOT NULL.** §9.3 requires a reason for
manual adjustments; the column makes "I'll add it later" impossible.

**Inactive variants stay readable.** The RLS policy on `product_variants`
deliberately does not hide inactive rows, because §8.4 wants a sold-out size
shown as disabled rather than silently missing from the selector.

**Row rules are not column rules.** `profiles_self_write` says
`id = auth.uid()` on both sides, which is a perfectly good ROW rule and says
nothing at all about columns — and `profiles` holds `role`. Since the
publishable key is in the browser by design, that left any signed-in customer
able to make themselves an owner through PostgREST. 020 fixes it with column
privileges, which PostgREST honours. No route ever permitted it, but a route is
not the lock.

## The one thing RLS cannot do for you

A guest has no `auth.uid()`, so no policy can reach their order. Guest order
lookup has to go through a server route taking order number **and** email,
using the service role.

Do not solve this with a policy matching on email. An email address is not a
secret — that policy would expose every guest order to anyone who can guess an
address. The route returns the same message for "no such order" and "wrong
email" for the same reason: two different replies make it an order-number
oracle.

## What the schema does not enforce

These are application concerns, and all four are now implemented — named here
so the next person can find them rather than re-derive them:

- **Stripe webhook signature verification against the raw body** (§12) —
  `app/api/stripe/webhook/route.ts` reads `await req.text()` before anything
  parses it, because `constructEvent` needs the bytes Stripe signed.
- **Rate limiting on auth and sensitive mutations** (§12) — `lib/rate-limit.ts`
  calling `rate_limit_hit()` from 006. In memory it would not work: serverless
  has no single process, so a cold instance hands out a fresh allowance.
- **Zod schemas on every mutation** (§12) — every one is `.strict()`, so a
  client sending `unit_price_pence` gets a 400 rather than a discount.
- **The return window counted from delivery, not the order date** —
  `request_return()` coalesces `delivered_at`, then `shipped_at`, then
  `placed_at`. Counting from the order date on a parcel that took two weeks to
  arrive would quietly eat most of the customer's window.

Still genuinely open at the database level:

- **Nothing publishes a scheduled collection.** `status = 'scheduled'` with a
  real date is honoured by RLS — the storefront cannot see it — but no cron or
  scheduled function ever flips it to live. A10 says so on the screen rather
  than implying a system that publishes for you.
- **`store_settings.collection_fee_pence` and `.from_email` have no reader.**
  Seven of the nine columns do.
- **`orders.billing_address` and `returns.label_expires_at` are never
  written.** Several screens narrow a claim because of it; see CLAUDE.md.
- **No per-transition timestamps on fulfilment.** `fulfilment_status` is one
  current value with no history, so A12's timeline can show real times only for
  `placed_at`, `shipped_at` and `delivered_at`.

## Working against the live project

Migrations are numbered and never edited once applied. Fix forward.

This environment's Supabase tooling gates DELETE and DROP behind an interactive
confirmation that never arrives in a session, so both time out — including a
DELETE matching no rows, which is what proved it was the gate rather than a
lock or a bad predicate. Plain DDL goes through fine. Plan migrations to be
additive; anything needing a DROP has to go to the owner. That is why 014's
`refund_return()` wraps `record_refund()` instead of replacing it, and why
`adjust_stock()` reads its actor label from `profiles` rather than taking a
parameter — adding one changes a function's identity, which needs a DROP.
