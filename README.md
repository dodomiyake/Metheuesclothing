# Metheues Clothings

T-shirt-first storefront and admin, built to the MVP v2.0 specification.

| | |
|---|---|
| Design | Figma `9SzUlTWGVKOCkAULkbqOsr` — 64 screens, 9 email templates, 16 components |
| Database | Supabase `afzuhymegntqjwtdkmfb`, eu-west-2 |
| Stack | Next.js App Router, TypeScript, Supabase, Stripe, Resend |

## Layout

```
supabase/migrations/   schema, RLS, integrity functions
app/api/               checkout, Stripe webhook, order lookup, returns
lib/                   Supabase clients, money helpers, transactional email
design/tokens/         CSS and TS tokens exported from Figma
```

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the server-only keys
npm run dev
```

The Supabase URL and publishable key are already in `.env.example`. The
service-role key, Stripe keys and Resend key are not, and must never be
committed — see §12.

## The rules this codebase is built around

Four guarantees from §18 are enforced by Postgres rather than application code,
because a constraint cannot be forgotten in a refactor:

- **Stock cannot go negative** — a CHECK constraint. An oversell raises; it does
  not clamp to zero.
- **Stock decreases exactly once** — a unique index on
  `(order_id, variant_id, kind)`. A replayed webhook inserts nothing.
- **One checkout, one order** — `webhook_events.stripe_event_id` is the primary
  key; the event is claimed before any work happens.
- **Price is server-authoritative** — `price_cart()` accepts only variant IDs and
  quantities. Nothing priceable comes from the browser.

Two more the same way:

- **A guest proves order number and email together** — there is no RLS policy
  that would let either alone identify a customer, and every failure returns one
  identical message so the endpoint cannot be used to enumerate order numbers.
- **A return is all-or-nothing** — `request_return()` validates and inserts in
  one transaction, so a rejected line cannot leave an empty return behind.

Each is verified, not assumed — see `supabase/migrations/README.md`.

## What is not here yet

Code still to write:

- Resend wiring for the remaining seven templates. E3 (order confirmation)
  and E6 (return request received) are built and wired into the webhook and
  `POST /api/returns`; `lib/email/layout.ts` has the shared chrome the rest
  should reuse rather than duplicate.
- Rate limiting on the auth routes. Checkout, order lookup and returns already
  have it; the budgets live in `LIMITS` in `lib/rate-limit.ts`.
- The admin side of returns: receiving, approving or rejecting, and the restock
  decision. `return_items.restock` stays false until a human sets it.
- The catalogue, product, bag and account pages themselves.

Not code, and blocking launch rather than blocking development:

- Product photography.
- Verified garment measurements per §8.5. The size tables in the design are
  placeholders and must not ship as-is.
- Real delivery rates, and confirmation of the £150 free-delivery threshold.
- Legal review of the privacy and returns copy.
