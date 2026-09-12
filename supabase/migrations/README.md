# Metheues Clothings — database

Three migrations implementing §10 of the MVP, written so the guarantees in §18
are enforced by Postgres rather than by remembering to check.

| File | What it does |
|---|---|
| `001_schema.sql` | Tables, constraints, indexes |
| `002_rls.sql` | Row level security |
| `003_functions.sql` | Stock, pricing and audit integrity |

**These have not been applied to your Supabase project.** Review them, then run
them in order — or say the word and I'll apply them.

## The five guarantees, and where they actually live

§18 lists things that must be true at launch. Four of them are easy to write in
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

**"One successful checkout creates exactly one durable order"** — 
`webhook_events.stripe_event_id` is the primary key. Record the event before
doing the work. If the insert conflicts, you have already handled it: return
200 and stop.

**"The amount charged comes exclusively from server-authoritative data"** —
`price_cart(jsonb)` takes only variant IDs and quantities, which is all §12
permits the browser to send, and returns what those actually cost. Hand its
output to Stripe. Nothing in the request body can influence a price.

**"Administrators can be held to what they did"** — `audit_logs` has triggers
blocking UPDATE and DELETE. An audit trail the owner can edit is not an audit
trail.

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
skipped on a busy day.

**`inventory_adjustments.reason` is NOT NULL.** §9.3 requires a reason for
manual adjustments; the column makes "I'll add it later" impossible.

**Inactive variants stay readable.** The RLS policy on `product_variants`
deliberately does not hide inactive rows, because §8.4 wants a sold-out size
shown as disabled rather than silently missing from the selector.

## The one thing RLS cannot do for you

A guest has no `auth.uid()`, so no policy can reach their order. Guest order
lookup has to go through a server route taking order number **and** email,
using the service role.

Do not solve this with a policy matching on email. An email address is not a
secret — that policy would expose every guest order to anyone who can guess an
address.

## What still needs writing

The schema does not enforce these; they are application concerns:

- Stripe webhook signature verification against the **raw** body (§12)
- Rate limiting on auth and sensitive mutations (§12)
- Zod schemas on every mutation (§12)
- The return window check — `store_settings.return_window_days` counted from
  delivery, not from the order date
