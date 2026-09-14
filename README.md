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
                        app/(site)/ page — icons.tsx has the real Figma
                        exported icons
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
  asset — a deliberate choice, not a blocked one: Figma's "Colours" asset
  there is a flat mockup image of one product's example colours, not a
  reusable component, so a downloaded copy couldn't represent every real
  product's actual colour set the way the CSS-driven dots already do.
  Product detail (`app/(site)/shop/[slug]/`) is now matched against
  04A/B/C (node 60:878/58:783/54:703, all three pulled directly — an
  earlier pass inferred Tablet from a design-system-state.json summary
  instead, got the gallery/spec layout wrong, and was caught and fixed by
  actually pulling it): a thumbnail-rail gallery, Add to Bag chips
  matching the real Filter Chip component, stock state and a
  sold-out-sizes line derived from `stock_quantity` vs
  `low_stock_threshold`, a sticky mobile/tablet purchase bar that appears
  once the panel's own button scrolls out of view, a three-column
  specification section, a design-story band and a related-products grid.
  The design's Print method/placement rows have no backing column
  anywhere and are omitted; Care stays one combined block
  (`care_instructions`) rather than the design's four separate
  Wash/Dry/Tumble/Iron rows; delivery and returns pull
  `store_settings.free_delivery_threshold_pence` and `.return_window_days`
  live rather than the design's unverified Estimate/Carrier rows. Still
  an image well placeholder, and add-to-bag confirms inline rather than
  the design's side panel/bottom sheet. The bag (`app/(site)/bag/`) is
  matched against 05A/B/C (node 72:1215/69:1101/65:993, all three pulled
  directly): a real Quantity Control stepper (decrement/quantity/increment,
  disabled at the checkout API's own 1/10 bounds) instead of a number
  input, Ghost/Secondary/Primary buttons matching the real Button
  component, and Desktop's own "N items · M T-shirts" subtitle/Estimated
  VAT row/delivery-banner-hosted Continue-shopping vs. Tablet and Mobile's
  summary-hosted one — genuinely three layouts, not one CSS breakpoint.
  Two disclosed deviations from what the screens show: none of the three
  depict an email field (moving its collection to Stripe's own hosted
  page would leave `orders.email` unknown until the webhook fires, which
  ripples into guest order lookup and the confirmation email — a real
  architecture question for the owner, not something to infer from one
  screen's omission) or a next-day delivery choice (a real, working,
  priced option the checkout API already supports, kept as a compact
  opt-in rather than deleted to match a screen that simply doesn't depict
  that state); the delivery banner also drops the design's carrier/ETA
  line for the same blocked-on-owner reason product detail's spec section
  omits its own. Cart still stays localStorage rather than server-side.
  Every price the bag shows is re-fetched from `product_variants` on load
  and is still only a display convenience — `POST /api/checkout` reprices
  from `price_cart()` regardless of what the browser sent, same as always.
  `app/(site)/track-order/` has had its own pass too. There is genuinely
  no guest-lookup Figma screen — confirmed by pulling "12 Orders"' (the
  signed-in Orders list) metadata rather than trusting the uncertainty
  noted elsewhere: it carries only a small CTA pointing a guest
  elsewhere, not a lookup form — so the form itself reuses the auth
  cluster's own Form Field/Button styling
  (`app/(site)/form-styles.ts`, moved up from `(auth)/` so a fifth real
  consumer outside auth doesn't read as a layering mistake). The result
  view rebuilds 13 Order Detail (node 103:3631) with the account-only
  chrome stripped out (nav rail, "Your account" breadcrumb, "All orders"
  link — none apply to a guest with no account): a real 5-step progress
  timeline from `payment_status`/`fulfilment_status`/`fulfilments`,
  Estimated VAT computed from `store_settings.vat_rate_basis_points`
  rather than a static "Included" label, and Start a Return gated on real
  `delivered_at`/`return_window_days` matching what `request_return()`
  itself enforces server-side rather than the mockup's hardcoded "30
  days". The design's Payment section (card brand/last4, billing address)
  and its Cancel-order action are omitted rather than faked or
  dead-ended: `payments.card_brand`/`.card_last4` and
  `orders.billing_address` exist as columns but no code path ever writes
  to them, and there is no cancel-order route to ever enable that button.
- The site header/footer/announcement bar (`components/site/`) are matched
  to Figma nodes 10:2 / 21:66 / 24:2, including the real exported icon
  assets (search, account, bag, dismiss) in `components/site/icons.tsx` —
  earlier sessions had these as hand-authored stand-ins because this
  sandbox's network egress blocked www.figma.com outright; that block has
  since lifted (an environment/network-policy change, not a code change)
  and the real assets are wired in. Menu stays hand-authored deliberately:
  Figma builds it from three plain rectangles, not an exportable
  vector/image node.
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
