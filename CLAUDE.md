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
   44px minimum. `design/tokens/README.md` has the rest. Three corrections
   the palette enforces rather than suggests:
   - Slate `#5F5F5F` fails AA on dark (2.4:1) — use `#A3A3A3` there.
   - **The accent is a GROUND, never type on a pale surface.** Acid
     `#D8F34A` on Paper is 1.26:1. `--mc-accent` is a fill, `--mc-accent-text`
     (ink) is what sits on it, `--mc-accent-on-dark` is the accent used AS
     type on ink or graphite. Figma's `Semantic/accent` has TEXT_FILL removed
     from its scopes so the picker cannot offer the wrong one.
   - **Two border tokens, and swapping them makes forms invisible.**
     `--mc-border-control` (`#767676`) for inputs, selects, chips, steppers —
     on a Paper ground a white control has 1.02:1 of fill contrast, so its
     border is the only thing identifying it and WCAG 1.4.11 wants 3:1.
     `--mc-border-default` (`#E0E0E0`) is decorative only.

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
- Every screen was matched against its *desktop* Figma frame and the shared
  chrome was matched against one breakpoint only, so the phone was never
  actually the design. Three separate causes, all found together when the
  owner said "the mobile view is a total mess":
  (a) `--mc-type-page-title` was a flat 52px carrying a comment that named a
  38px mobile size nothing implemented — every `h1` on the site rendered at
  52px on a 390px phone, one word per line on the product title. It is now
  declared mobile-first and stepped up at 768/1440, and redefining a custom
  property in a media query reaches all six call sites without any of them
  knowing a breakpoint exists. `form-styles.ts` had opted six screens out of
  it entirely with a hardcoded `fontSize: 48`.
  (b) Header and Footer have three real Breakpoint variants that differ in
  *content*, not just size — mobile has one icon (Bag) against desktop's
  three, and the footer's link columns are 2×2 on a phone. Both were built
  from the desktop frame, so the wordmark sat 22px off centre (the 44px
  imbalance the FILL columns exist to prevent) and the footer was one tall
  stacked list. Pulling all six variants is what fixed it.
  (c) Inline `display` beats every stylesheet rule, so the icon buttons'
  inline `display: flex` silently defeated the media queries meant to hide
  them per breakpoint — the fix measured as having changed nothing. Same
  trap as the bag's Continue-shopping button. Anything a breakpoint hides
  must not carry an inline `display`.
- `product_variants.size` is free text, so `.order('size')` is alphabetical:
  size chips, size filters and the admin stock list all read "L, M, S, XL,
  XXL". Postgres can't fix it without an enum the schema doesn't have, so
  `lib/shop/size-order.ts` does, with unknown values kept rather than dropped.
- The palette was changed twice in one week because both times it was judged
  from hex values and a token file rather than from a rendered page. Warm
  gold was the same recipe as two sibling brands; its cool replacement
  (ultramarine on a blue-grey ground) read as a SaaS dashboard — which only
  became obvious when the real listing page was rendered side by side in
  candidate palettes. Render the actual screen before choosing, not after.
  The second swing also surfaced two things a hex swap alone would have
  missed: native checkboxes and radios paint their checked state with the
  BROWSER's accent (system blue) unless `accent-color` is set, so a blue tick
  survived a palette with no blue in it; and dropping the tinted page ground
  removed the fill contrast that had been identifying white inputs, which is
  why `--mc-border-control` exists.
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
the app. The shared chrome has now had a real
three-breakpoint pass of its own (Header 15:20/15:2/10:2, Footer
21:35/23:2/21:4, all six pulled): per-breakpoint icon sets, padding and
wordmark sizes, a footer grid whose column counts reproduce the designs'
measured 159/152/288 widths exactly, and a page-title token that actually
steps down — verified by measuring the live DOM at 390/768/1440, not by
eye (wordmark offset 0 at all three, matching what design-system-state.json
recorded years before anything implemented it). The mobile discovery bar's
sort control was rebuilt as the Button the design draws rather than a bare
`<select>`, which sized itself to its longest option and pushed the result
count off a 390px screen. `app/admin/sign-in/` has now had it too (A01, all three of
126:10/32/54 pulled): the three breakpoints are one screen at two card
widths (350 mobile, 420 from 768 up), and the earlier version had the
central idea inverted — a graphite card with dark inputs and a white
button, where the design is a WHITE card on a black page. Measured
against the design at all three widths rather than eyeballed. Three
departures, all deliberate and all narrowing a claim rather than
widening one: the Default Form Field's border uses
`--mc-border-control` (the Figma component was rebound to match, so the
two do not diverge); "Forgotten your password?" keeps its underline,
since ink-on-white text has no other affordance; and the small print is
rewritten, because the design's version makes four security claims the
system does not keep — no 12-hour session expiry exists (it is a
Supabase Auth dashboard setting, flag it for the owner like the E1/E2
send-email hook), sign-ins are not written to audit_logs, there is no
admin refund action to log yet, and stock adjustments go to
inventory_adjustments rather than audit_logs. What replaced it is the
narrower true thing: audit_logs is append-only, enforced by the
forbid_audit_mutation triggers. The password helper says 10, the real
`z.string().min(10)`, not the design's 12.

Every storefront and auth screen has had the real-Figma pass, and the
admin has started on its own: `app/admin/(protected)/orders/` is A11
Orders, all three nodes pulled (128:1827/128:1606/128:1421). The
structural fact there was worth pulling rather than inferring — the admin
has TWO independent breakpoints, not one: the rail becomes a top bar at
1440 while the records become a card list at 768, so TABLET IS NOT
MOBILE (stacked top bar, full seven-column table). Verified by measuring
the live CSS at 390/768/1440. Also added `components/admin/status-badge.tsx`
— the real Status Badge (125:26), a white pill with a tone dot so the WORD
carries the meaning; the three ad-hoc badges it replaces (products,
inventory, variant manager) carried five hardcoded pastel hexes that were
in no palette this project has ever had and had survived both recolours,
because a raw hex is invisible to a token change. Omitted from A11, not
faked: "Export orders" and "Print pick list" (no route, no format, no
pick-list definition), and the seven rail items whose pages do not exist
— a rail full of 404s is worse for staff than a short one. `packed` is
labelled "Packed", not the design's "To pack": six labels for six enum
values and five line up, but that one inverts the meaning (`packed` means
packing is DONE) and would send someone to re-pack a parcel. Worth
settling with the design owner alongside the E7 naming. NOTE: the orders
filters and search are the first queries in this codebase using jsonb
paths (`delivery_address->address->>country`, `delivery_address->>name`)
and, like everything else here, have never run against a reachable
database — they typecheck and build but are unexercised.

A12 Order details is now built (139:1861/139:1620/139:1379, all three
pulled), so A11's rows land somewhere. Unlike A11 it has ONE breakpoint:
tablet and mobile both stack Order main above Order side in the same
order, and the split is at 1440 only — read from the frames rather than
assumed to match A11. It is deliberately a READ screen: the design hangs
eight actions off it and exactly one (Open in Stripe) has anywhere to go,
because A13 Fulfilment, A14 Add tracking, A15 Cancel and A16 Refund are
unbuilt screens with no routes behind them. Four panels are omitted for
four different reasons, all recorded in the page's own comment — internal
notes (no table exists at all, and orders.customer_note is the CUSTOMER's
note, so rendering it under a staff-only heading would invert its
meaning); payment method (payments.card_brand/card_last4 EXIST but the
webhook never writes them — a few lines from being true, worth doing);
phone (checkout never asks Stripe for one); and the delivery estimate
(nothing stores or computes one).

Two findings worth carrying forward. First, EVERY audit_logs insert in
this codebase is a failure path — oversell_detected and
email_delivery_failed — so a successful payment or return writes nothing.
The A01 small print shipped in 7f3f90b overclaimed this ("returns and
payment events are written to an audit log") and has been corrected to
the only true claim, which is about the log's integrity rather than its
coverage. An audit log that records only failures is probably not what
anyone wants; closing it is nearly free once the A13–A16 actions exist,
since each is already a write. Second, the schema has no per-transition
timestamps at all: fulfilment_status is one current value with no history,
so A12's timeline shows real times only for placed_at, shipped_at and
delivered_at and says plainly that the rest are unrecorded.

The admin rail now collapses behind a toggle below 1440 — a deliberate
departure, recorded in admin-rail.tsx. A11/A12 Mobile draw it as ten
212px chips wrapping into a ~494px slab on an 844px-tall phone, and our
first build inherited the 212px width with three items, leaving a strip
of dead black beside every row (212 only means something inside a 240px
sidebar). Collapsed the bar is 76px; opened, rows go full width. The
rail still swaps at 1440 exactly as the frames show — only the collapsed
shape differs. Alongside it, `components/admin/wide-only.tsx` gates the
three editing screens (A04 Edit T-shirt, A06 Generate variants, A08
Adjust stock) below 768 with a short message instead of a squashed form.
That matches the design file's own split, which is worth knowing: of 23
admin screens 7 have a Mobile frame and 16 do not, and the line is
almost exactly read vs write — sign-in, dashboard, the three queues and
Order details get a phone layout; every editor, settings screen and
consequential action is Desktop+Tablet only. NOTE that rationale is read
off which frames exist; no decision to that effect is recorded in
design-system-state.json, so confirm it with the design owner rather
than treating it as settled.

The dispatch path is built and migration 011 IS APPLIED (advisor run
straight after per rule 3: neither new function appears in the
"Public Can Execute SECURITY DEFINER" findings, so the REVOKEs took; the
two that do appear, is_staff/is_owner, are deliberate and documented at
004_lock_down_functions.sql:20). advance_fulfilment and ship_order are
the first functions here to write a SUCCESS row to audit_logs, which
closes the failure-only gap noted above. A14 Add tracking is wired into
A12's Tracking panel.

A14 CONTRADICTS ITSELF and the design system settles it: the dialog
header says "There is no separate send button — the dispatch email goes
out as part of this", then draws a "Send the dispatch email now"
checkbox, which is exactly a separate send control. The Checkbox
component's own description says a setting that cannot be switched off
should be a locked row with an ALWAYS ON tag rather than a tickbox
nobody can untick — so the email always sends and the row is locked.
Raise it with the design owner alongside "To pack" and the E7 naming.
Two further A14 departures: CARRIER is a text input with suggestions
rather than the drawn closed select (no carrier list exists anywhere;
delivery_method is free text, and a managed list belongs in
store_settings), and the tracking link does NOT auto-fill from carrier
and number as the design's helper claims — that needs per-carrier URL
templates, and guessing them is the same failure the tracking-number
helper warns about.

Next: A13 Pack (the packing workflow — pick list, seal checklist, Mark
packed gated on every line ticked; its "Rail A · shelf 3" locations have
no backing column and will be omitted), then A15 Cancel and A16 Refund
with E5/E8. Also still open: the two oldest admin tables (A03
T-shirts, A07 Inventory) have Mobile frames that were never implemented —
they are desktop tables at every width, with no record-list fallback and
no overflow wrapper, so they squash rather than scroll. Then: the remaining seven Resend templates (`lib/email/layout.ts` has the
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
