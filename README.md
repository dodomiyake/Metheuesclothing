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
app/api/               checkout and Stripe webhook
lib/                   Supabase clients, money helpers
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

Each is verified, not assumed — see `supabase/migrations/README.md`.
