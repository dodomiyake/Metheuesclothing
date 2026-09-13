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
                        admin catalogue writes, newsletter
app/(site)/            everything with the storefront header/footer/
                        announcement bar — home, shop, bag, track-order,
                        (auth)/*
app/(site)/(auth)/     sign in, register, forgot/reset password, verify
                       email — 460px column, matched to the real Figma
                       screens (10A/10D, 27, 28), not just the design tokens
app/auth/callback/     lands every emailed auth link, exchanges its code,
                       routes to the right state (verified/expired) on 27/28
app/admin/              staff-only: T-shirts, variants/stock, inventory —
                        its own black-rail chrome, deliberately not
                        components/site's storefront header/footer
components/site/       Header, Footer, AnnouncementBar shared by every
                        app/(site)/ page — see the note in icons.tsx before
                        assuming those icons are the real Figma exports
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
  history — §8.10). Auth (register, sign in/out, forgot/reset password,
  email verification) is built and matched to the actual Figma screens —
  `app/(site)/(auth)/` and `app/api/auth/`, rate limited the same way
  checkout and returns are, including the resend-with-cooldown pattern
  from 27/28's design states.
- The shop listing (`app/(site)/shop/page.tsx`) is now matched against
  the real screens (03A/B/C, node 51:531/50:406/47:287) rather than the
  earlier token-styled approximation: breadcrumb, a persistent filter rail
  at 1440px+ and a discovery-bar-and-sheet pattern below it (03D, node
  53:674), removable active-filter chips, sort, and New/Limited
  Edition/Low stock/Sold out labels on the product card. Every filter is
  real — Size/Colour read `product_variants`, Fit reads `products.fit`,
  Collection reads `product_collections`/`collections` (empty today, so
  that group renders nothing rather than fake options), Availability is
  `stock_quantity > 0`. The design's "Design style" filter group
  (Graphic/Essential/Limited) has no backing column anywhere in the
  schema and is deliberately omitted rather than faked. Colour swatches
  are small flat-colour dots keyed by colour name, not the real exported
  asset — same network-block caveat as `components/site/icons.tsx`.
  Product detail (`app/(site)/shop/[slug]/`) and the bag
  (`app/(site)/bag/`) have not had this pass yet — still no image
  gallery, add-to-bag as inline text rather than a side panel/bottom
  sheet, cart as localStorage rather than server-side. Every price the
  bag shows is re-fetched from `product_variants` on load and is still
  only a display convenience — `POST /api/checkout` reprices from
  `price_cart()` regardless of what the browser sent, same as always.
  `app/(site)/track-order/` is in the same state: functional, wired to
  real routes (`POST /api/orders/lookup`, `POST /api/returns`), not yet
  checked against its actual Figma screens (12 Orders / 13 Order Detail /
  14-17 Returns — those are the signed-in account version; a guest-lookup
  equivalent may not exist as its own Figma screen at all).
- The site header/footer/announcement bar (`components/site/`) are matched
  to Figma nodes 10:2 / 21:66 / 24:2, with one disclosed gap: the search,
  account and bag icons are hand-authored stand-ins, not the real exported
  assets — this sandbox's network egress blocks www.figma.com from every
  tool that could fetch them (curl, WebFetch, `download_assets` all hit the
  same wall the Supabase work did all session). See the comment in
  `components/site/icons.tsx`.
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
