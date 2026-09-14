# Metheues Clothings — working notes

T-shirt-first storefront and admin. UK, GBP, integer pence everywhere.

`docs/SPEC.md` is authoritative. Section numbers in comments (§10, §12, §18)
refer to it. When this file and the spec disagree, the spec wins.

| | |
|---|---|
| Figma | `9SzUlTWGVKOCkAULkbqOsr` — 64 screens, 9 email templates, 16 components |
| Supabase | project `afzuhymegntqjwtdkmfb`, eu-west-2 |
| Stack | Next.js App Router, TypeScript, Supabase, Stripe, Resend |

`docs/design-system-state.json` is the design ledger: every Figma node id,
component property key and build hazard. Read it before touching the Figma file;
it is the only record of which node is which.

## Rules this codebase is built around

These are not preferences. Each one is here because the alternative was tried,
or because the database enforces it and application code cannot opt out.

1. **Money is integer pence.** Never floats, never formatted strings parsed back.
2. **Prices come from the database.** `price_cart()` accepts variant ids and
   quantities only. Every checkout schema is `.strict()` so that a client sending
   `unit_price_pence` gets a 400, not a discount.
3. **Every `SECURITY DEFINER` function needs an explicit `REVOKE`.** Supabase
   exposes functions over `/rest/v1/rpc/` and grants EXECUTE to `anon` by
   default. Three functions shipped callable by the public internet before the
   security advisor caught it (see commit `fcd256a`). The pattern is:
   ```sql
   revoke execute on function f(args) from public, anon, authenticated;
   grant  execute on function f(args) to service_role;
   ```
   Run `get_advisors(type: "security")` after every migration that adds one.
4. **Multi-row writes belong in a Postgres function.** The Supabase JS client has
   no transaction. `request_return()` exists because doing it from the route
   leaves half-created returns behind when the second insert fails.
5. **Guests prove order number AND email, together, through a server route.**
   There is deliberately no RLS policy for guest order access — a policy matching
   on email alone would let anyone who knows an address read that customer's
   orders. See the note in `002_rls.sql`.
6. **Lookup failures are indistinguishable.** One message for "no such order" and
   "wrong email", or the endpoint becomes an order-number oracle.
7. **`import 'server-only'`** at the top of anything that touches the service role
   key, so importing it from a client component is a build error rather than a
   leak.
8. **Colour is never the only signal for state**, and interactive targets are
   44px minimum. `design/tokens/README.md` has the rest, including the one
   palette correction: Stone `#68635D` fails AA on dark, use `#8A8178`.

## Things that have already gone wrong

Worth reading before repeating them.

- A webhook handler that threw *after* claiming its event left the claim row
  behind. Stripe's retry then hit the duplicate guard and got a 200 — the work
  never happened and nothing reported it. The catch block deletes the claim.
- `store_settings` had no row. `now() > ts + make_interval(days => NULL)` is
  NULL, not true, so the returns window check silently never fired. A missing
  config row meant an unlimited returns window. Functions now raise rather than
  assume.
- Rate limiting in a `Map` does not work on serverless — no single process, so a
  cold instance hands out a fresh allowance. It is counted in Postgres.
- `x-forwarded-for` is a request header. It is only trustworthy because Vercel
  overwrites it at the edge. Change hosting and the limiter silently stops.
- Every Server Component reading the catalogue destructured `data` from a
  Supabase query and ignored `error`. `data` comes back `null` on a query
  error the same way it does when there are genuinely no rows, so a
  database that could not be reached rendered as "nothing published yet" —
  found when a real network block (this session's sandbox, not production)
  made every query fail and the shop page reported an empty catalogue
  instead of an error. Same shape of mistake as store_settings having no
  row: a real problem reading as a harmless empty state. Every page under
  `app/shop/`, `app/bag/` and `app/admin/` now checks `error` and throws
  rather than falling through to the empty-state branch; `notFound()` is
  only called when `error` is absent AND the row is genuinely missing.
- The auth screens were built styled with the design tokens (right colours,
  right fonts, right spacing) but without ever pulling the actual Figma
  layouts — no site header, no footer, no announcement bar, thinner copy,
  a bordered-card treatment the design doesn't use. Tokens are necessary,
  not sufficient: they make a page look like it belongs to the system
  without making it the actual screen. `get_design_context` per screen
  (loading `figma-design-to-code` first, per its own gate) is what closed
  the gap for auth; the shop listing, product detail, the bag and
  track-order have since had the same pass (see State below) — only
  `app/admin/sign-in/` is still pending it.

## State

Done: schema + RLS + integrity functions (migrations 001–010, all applied),
checkout, Stripe webhook, guest order lookup, returns, rate limiting, design
tokens, E3 order confirmation and E6 return request received emails, the
Next.js scaffold (it never existed as a committed package.json until now —
see the "scaffold" commit), auth — register, sign in/out, forgot/reset
password, email verification, all rate limited, matched against the real
Figma screens (10A Sign In, 10D Create Account, 27 Password reset, 28 Email
verification — all under `app/(site)/(auth)/` and `app/api/auth/`) rather
than just styled with tokens, the admin catalogue MVP under `app/admin/`:
T-shirts create/edit, colours/sizes/stock (A06+A08 combined into one page),
and a read-only inventory view (A07) — the customer catalogue/bag under
`app/(site)/shop/` and `app/(site)/bag/`, closing the loop from browsing to
the checkout route that existed for months with no UI in front of it — and
`app/(site)/track-order/`, doing the same for guest order lookup and return
requests (POST /api/orders/lookup and POST /api/returns were both built
early in this project's history and had no page calling either until now).
The shop/bag/track-order pages have NOT had the same real-Figma pass the
auth cluster just got — see "Things that have already gone wrong" above.
Also added: `components/site/` (Header, Footer, AnnouncementBar, shared by
every `app/(site)/` page — matched to Figma nodes 10:2/21:66/24:2, including
the real exported icon assets in icons.tsx once this environment's
www.figma.com network block lifted — see icons.tsx's own comment), and
`POST /api/newsletter` wiring up
`LIMITS.newsletter`, which had sat unused in lib/rate-limit.ts since it was
first written. Migration 009 added the `handle_new_user`
trigger profiles always needed and never had; migration 010 added
`adjust_stock()`, the SECURITY DEFINER function manual stock changes go
through, for the same reason 002_rls.sql gives staff no INSERT policy on
inventory_adjustments — see both migrations' comments. The §18 guarantees
were verified against the live database rather than assumed — see
`supabase/migrations/README.md` (stale as of 003 — it predates 004–010 and
is due a rewrite, not a launch blocker).

The live database has zero products, variants or collections, and — as of
this session — zero users, so nothing in the admin catalogue, auth flows or
storefront has been exercised end to end with real data. What verification
found instead is in "Things that have already gone wrong" above: this
sandbox's network egress blocks Supabase entirely (`Host not in allowlist`),
which surfaced that every catalogue page was swallowing query errors as
empty states — fixed, but still means the actual "products render
correctly" path has never been observed, only exercised via `tsc`/`next
build`/a dev-server smoke test of the unauthenticated and now-loud-on-error
paths. Production is a different network and will not have this specific
problem, but has its own unverified gap: the Vercel project has no
environment variables configured at all (see the "fail open" commit), so
until the owner sets them, the deployed app is in the same
never-reaches-Supabase state this sandbox is permanently in. There is no
self-service way to become staff by design (see README) — someone with
database access has to run one UPDATE on `profiles` before the admin
screens can be walked through for real.

Next: the shop listing (`app/(site)/shop/page.tsx`) has now had the real-Figma
pass (03A/B/C + the 03D filter sheet, node 51:531/50:406/47:287/53:674) —
real filters (Size/Colour/Fit/Collection/Availability, all reading actual
columns; "Design style" omitted, no backing column anywhere), New/Limited
Edition/Low stock/Sold out derived from real data, a persistent rail at
1440px+ and the discovery-bar-and-sheet pattern below it. Product detail
(`app/(site)/shop/[slug]/`) has had the same pass (04A/B/C, node
60:878/58:783/54:703, all three pulled directly — an earlier pass here
inferred Tablet from a design-system-state.json summary instead and got
the gallery/spec layout wrong, caught and fixed by pulling it for real):
the Add to Bag chips match the real Filter Chip component, stock state and
the sold-out-sizes line are derived from stock_quantity vs
low_stock_threshold rather than a generic toggle, a sticky mobile/tablet
purchase bar appears once the panel scrolls out of view, and the
specification section pulls delivery/returns from `store_settings` live
rather than the design's unverified Estimate/Carrier rows — Print
method/placement and the four separate Care rows stay omitted for the same
no-backing-column reason as shop's "Design style" filter. The bag
(`app/(site)/bag/`) has had the same pass too (05A/B/C, node
72:1215/69:1101/65:993, all three pulled directly): a real Quantity
Control stepper, Ghost/Secondary/Primary buttons matching the real Button
component, and Desktop's distinct "N items · M T-shirts"/Estimated
VAT/delivery-banner-hosted Continue-shopping vs. Tablet/Mobile's summary-
hosted one. Email collection and the next-day delivery option both stay
where they already worked rather than being cut to match screens that
simply don't depict them — see the bag page's own comment. Track-order
(`app/(site)/track-order/`) has had the pass too: there is genuinely no
guest-lookup Figma screen (confirmed by pulling "12 Orders"' metadata —
it carries only a small CTA pointing a guest elsewhere, not a form), so
the lookup form reuses the auth cluster's own Form Field/Button styling
(form-styles.ts, moved from `(auth)/` up to `(site)/` so a fifth real
consumer outside auth doesn't read as a layering mistake). The result
view rebuilds 13 Order Detail (node 103:3631) with the account-only
chrome stripped out: a real 5-step progress timeline derived from
payment_status/fulfilment_status/fulfilments, Estimated VAT computed from
`store_settings.vat_rate_basis_points`, and Start a Return gated on
real delivered_at/return_window_days matching what request_return()
itself enforces — the design's Payment section (card brand/last4, billing
address) and Cancel-order action are omitted, not faked or dead-ended:
those columns and that route don't exist/are never written anywhere in
the app. Only `app/admin/sign-in/` (A01, node 126:10/32/54) is still
pending the same treatment. Pull it with get_design_context
(`figma-design-to-code` skill loaded first) the same way every other
screen did — every node, not just the ones that seem safe to infer (the
product detail Tablet mistake is worth re-reading before assuming any
screen is close enough to guess). Then: the remaining seven Resend templates (`lib/email/layout.ts` has the
shared chrome — reuse it rather than duplicating table markup per template).
E1/E2 (verify email, password reset) now have a caller — Supabase Auth sends
its own default email today; routing that through our Resend templates
instead needs a Supabase Auth "send email" hook, a dashboard-level setting,
not application code — flag it for the owner rather than guessing at hook
config against the live project. E4/E5/E7 need the admin order actions
(dispatch, cancel), E8 needs the admin refund action, E9 needs the admin
return decision — build each template alongside the route that triggers it,
the way E3 and E6 went in. Also still open: the admin side of returns (the
E7-vs-"Return approved" naming in design-system-state.json's own decisions
list doesn't match its own id map — worth confirming with the design owner
before building the approve/reject function, not guessing), the admin
dashboard/collections/orders/customers/settings screens (A02, A09/A10,
A11 onward), and the customer-facing account pages (profile, addresses,
signed-in order history — now unblocked the same way the catalogue was,
since they need auth, which exists). The catalogue, bag and guest order
lookup+return (`app/shop/`, `app/bag/`, `app/track-order/`) are now
matched against their real Figma screens, not just built — but each still
carries disclosed, deliberate gaps (no product photography, cart stays
localStorage, no side-panel/bottom-sheet confirmations) — see README's
"What is not here yet" for exactly which parts of §8.2/§8.4/§8.7 are
deferred and why. `app/track-order/` has no order detail page of its own
(13 Order Detail) — everything it shows lives on the one lookup-result
page, reusing that screen's own content rather than a generic summary.

Blocked on the owner, not on code: photography, verified garment measurements
(§8.5 — the size tables in the design are placeholders and must not ship), real
delivery rates, the £150 threshold, a verified sending domain for Resend, and
legal review of the returns and privacy copy. Three seeded values in migration
008 are marked PLACEHOLDER for the same reason.

## Conventions

- Commit messages explain *why*, and name the failure mode when fixing one. The
  history is meant to be readable as a record of decisions.
- Migrations are numbered and never edited once applied. Fix forward.
- Test destructive database work against the live project only with data you
  created, and delete it afterwards — confirm the tables are back to zero.
