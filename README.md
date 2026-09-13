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
app/api/               checkout, Stripe webhook, order lookup, returns, auth,
                        admin catalogue writes
app/(auth)/            sign in, register, forgot/reset password — 460px card
app/auth/callback/     lands every emailed auth link, exchanges its code
app/admin/              staff-only: T-shirts, variants/stock, inventory
app/shop/               product listing and detail — the customer catalogue
app/bag/                cart (localStorage) through to Stripe Checkout
app/track-order/        guest order lookup into a return request
app/layout.tsx, page.tsx   root shell; page.tsx is a placeholder until the
                           homepage exists
lib/                   Supabase clients, money helpers, transactional email
lib/admin/              staff-session check, the product/variant zod schema
lib/bag/                localStorage cart — display only, never priced from
middleware.ts           refreshes the Supabase session cookie every request
design/tokens/         CSS and TS tokens exported from Figma
```

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the server-only keys
npm run dev
```

`npm run build` and `npm run typecheck` both run clean without any secrets
set — the routes that need them (checkout, the webhook, rate limiting) throw
their own clear error at request time instead (`SUPABASE_SERVICE_ROLE_KEY is
not set`, etc.), never at import or build time. Stripe and Resend clients are
constructed lazily for the same reason: a `new Stripe(...)` at module scope
used to throw during `next build`'s page-data collection, which happens
before any request and without .env.local necessarily loaded — see
`lib/stripe/client.ts` and `lib/email/client.ts`.

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
  should reuse rather than duplicate. E1 (verify email) and E2 (password
  reset) still send as Supabase Auth's own default email, not our branded
  template — redirecting those through Resend needs a Supabase Auth "send
  email" hook, which is a project-level setting only the Supabase dashboard
  can turn on, not something further application code unlocks.
- The admin side of returns: receiving, approving or rejecting, and the restock
  decision. `return_items.restock` stays false until a human sets it.
- The customer-facing account pages (profile, addresses, signed-in order
  history — §8.10). Auth (register, sign in/out, forgot/reset password) is
  built — `app/(auth)/` and `app/api/auth/`, rate limited the same way
  checkout and returns are. The catalogue and bag are also built
  (`app/shop/`, `app/bag/`) — reduced fidelity against §8.2/§8.4/§8.7: no
  filters, sorting or search yet, no image gallery (no photography
  exists), the add-to-bag confirmation is inline text rather than a side
  panel/bottom sheet, and the bag's cart is localStorage rather than a
  server-side bag a customer could pick up on another device. Every price
  the bag shows is re-fetched from `product_variants` on load and is still
  only a display convenience — `POST /api/checkout` reprices from
  `price_cart()` regardless of what the browser sent, same as always.
  `app/track-order/` is the guest path into the same order data plus a
  return request (`POST /api/orders/lookup` and `POST /api/returns`, both
  built since early in this project's history with no page in front of
  either until now) — no order detail page or tracking-number timeline
  beyond what fits on this one page yet.
- Admin: T-shirts (create/edit), colours/sizes/stock and a read-only
  inventory view are built (A03, A04 MVP subset, A06, A07, A08) —
  `app/admin/`. Not built: the dashboard (A02), collections (A09/A10), the
  image manager (A05 — no upload pipeline exists, and there is no real
  photography to manage yet), and everything past the catalogue (orders,
  returns, customers, homepage content, store settings, audit log — A11
  onward). There is also no self-service way to *become* staff — that is a
  direct `update profiles set role = 'staff' where id = ...` by whoever
  already has database access, the same bootstrap problem every app with
  roles has once.

Not code, and blocking launch rather than blocking development:

- Product photography.
- Verified garment measurements per §8.5. The size tables in the design are
  placeholders and must not ship as-is.
- Real delivery rates, and confirmation of the £150 free-delivery threshold.
- Legal review of the privacy and returns copy.
