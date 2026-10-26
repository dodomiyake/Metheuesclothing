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
`supabase/migrations/README.md`, which is current again: it indexes all
twenty-one migrations, states which are applied, and records the one hole
in the migration history (020). It spent a long while describing three.

The live database was empty for most of this project's history, and is no
longer. As of 24 October it holds 1 product, 15 variants, 7 orders (3
paid), 5 payments, 1 image, 8 audit rows, and still zero collections and
zero addresses — none of it created by these sessions, so the owner is
adding data and these numbers go stale fast. COUNT THEM RATHER THAN
QUOTING THIS LINE, and scope anything scripted against the project rather
than running blanket statements.

THE CHECKOUT PATH HAS NOW RUN FOR REAL, and this note used to say it had
not. Order MC-10006 went all the way through on 13 September 2026: 2 x
"STRIPED SHORT SLEEVE POLO TSHIRT" BLACK/L at £48.00 plus £3.95 delivery =
£99.95, payment_status paid, a real Stripe payment intent recorded, the
delivery-address snapshot written by the webhook, delivery_method
tracked_48, and stock decremented EXACTLY ONCE (one `sale`
inventory_adjustment of -2; that variant now sits at 0 and reads Sold out).
Three webhook events processed. So storefront -> checkout -> Stripe ->
webhook -> stock is proven end to end.

IT IS STRIPE TEST MODE, and this file twice said "real money", which was
wrong. Every payment row's stripe_checkout_session_id begins `cs_test_` —
all five of them, the most recent minutes old — so nothing here has ever
moved a real pound. That changes nothing about what is proven: a test-mode
payment intent, webhook delivery, signature verification, the duplicate
guard and the stock decrement are the same code paths on the same Stripe
API, which is exactly why test mode exists. What it does change is the
claim. The first live transaction is still ahead, and it is the one that
will exercise the things test mode cannot: a real card network, real
settlement, and Stripe's fee.

ONE THING FAILED, and it failed the way it was built to. audit_logs holds
`email_delivery_failed`: "E3 order confirmation to <the owner's address>
failed: The domain is invalid" — Resend refusing the send because the
sending domain is not verified, which is already on the owner-blocked list
below. The webhook did not throw, the order survived, stock stayed correct,
and a human got a record. That is exactly the §15 behaviour
sendTransactionalEmail exists for, observed rather than assumed.

CORRECTED: this file said MC-10006 sat at fulfilment_status `processing`
with no audit row because "nothing else moves that column, so it was set
directly in the table editor". THE WEBHOOK MOVES IT. Its paid branch
updates payment_status, fulfilment_status AND delivery_address in one
statement (webhook/route.ts:76), so every paid order goes straight to
`processing` with no audit row and no help from anyone — confirmed on
MC-10010, which did exactly that on 24 October with nobody touching the
table editor. advance_fulfilment's own `processing` arm still has no
caller, which is the true half of the original note; a direct column
update is not that function. What verification
found instead is in "Things that have already gone wrong" above: this
sandbox's network egress blocks Supabase entirely (`Host not in allowlist`),
which surfaced that every catalogue page was swallowing query errors as
empty states — fixed, but still means the actual "products render
correctly" path has never been observed, only exercised via `tsc`/`next
build`/a dev-server smoke test of the unauthenticated and now-loud-on-error
paths. BOTH OF THOSE ARE NOW CLOSED, and the catalogue path has been SEEN
WORKING. This note used to say the Vercel project had no environment
variables and that nobody was staff yet. All nine env vars are set
(STRIPE_PUBLISHABLE_KEY is production-only; the other eight cover preview
too), and the owner's account is `role = 'staff'`. On 11 October 2026 the
owner opened A07 Inventory on the deployed app and it rendered the real
catalogue: 15 variants, the real SKUs, BLACK/L at 0 reading Out of stock —
which is the variant MC-10006 sold two of. So the admin gate, the profiles
role read and a catalogue query have all now run against the live
database from a browser, not just through `tsc` and `next build`. This
sandbox still cannot reach Supabase (`Host not in allowlist`), so that
remains the reason screens are verified here by measurement and harness
rather than by loading them.

What that same screenshot exposed: PRODUCTION WAS 15 COMMITS BEHIND. `main`
sat at 7f3f90b (A01 admin sign-in) while the whole admin build lived on the
feature branch, so the owner was looking at the pre-rebuild A07 — bare
table, no top bar, no record list, and the audit-log overclaim that
d762e61 had already corrected and 015 had since made true. Worth checking
which deployment a screenshot came from before reading a bug into it.
Migrations 011-017 had meanwhile all been applied to the live database, so
the deployed code and the schema were out of step in the safe direction
only because every migration was additive.

THERE IS A DEDICATED ADMIN ACCOUNT NOW, created 11 October 2026 at the
owner's request: `admin@metheues.test`, `profiles.role = 'owner'`. There is
no separate admin credential system and there never was — A01 posts to the
same /api/auth/sign-in as the storefront, and being an admin is one row's
`role` column. The address uses `.test` (RFC 2606) so it can never be a
real mailbox and nobody can claim it; the trade-off is that password reset
can never reach it, which is correct for a test account. Supabase's auth
admin API is unreachable from this sandbox, so the auth.users row was
written directly with `crypt(..., gen_salt('bf'))` and then verified field
by field (confirmed, hash matches, one email identity, not banned, not
deleted); handle_new_user created the profiles row and only its role was
changed by hand. Deleting it later is a dashboard job — this environment's
tooling gates DELETE.

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

A13 Pack is built (139:2295/139:2116, both pulled — no Mobile frame, so it
is wrapped in WideOnly) and is the only caller of advance_fulfilment. ONE
breakpoint like A12: the columns split at 1440 and the side column is 340px
there, not A12's 380 — measured at 390/768/1440 rather than inherited from
the neighbouring screen. Mark packed is gated on every pick line being
ticked, which is what the design's own helper text says; the seal checklist
gates nothing and is not persisted, because no table backs it and storing
"returns slip included" would be storing a claim nobody verifies. Four
departures: the per-line "Rail A · shelf 3" is omitted (no warehouse column
exists anywhere, and a made-up shelf is the one invention a picker can
immediately disprove); "medium mailer" narrows to the real item count;
the design's "packed flat, not rolled" row — which it derived by reading a
customer note — appears only when `orders.customer_note` is set and quotes
it verbatim rather than paraphrasing; and "Step 2 of 4" is replaced by the
real fulfilment status. NOTE that `advance_fulfilment`'s `processing` arm
STILL has no caller: A13 draws no start button and A12 omits "Begin
packing", so marking packed jumps straight from not_started (legal, the
function allows a forward jump) and the queue cannot tell "untouched" from
"being picked right now". Worth settling with the design owner alongside
"To pack". Two corrections to A12 went in with it: its Fulfilment panel now
links to A13 instead of having no action at all, and the Shipped step no
longer claims "dispatch email not built yet (E4)" — it was stale the moment
011 landed, and rather than swap it for "email sent" (true most of the time
and wrong exactly when it matters, since the send is best-effort after the
DB write) it now shows only the timestamp and leaves email outcomes to the
audit panel, where email_delivery_failed actually lands.

A15 Cancel and A16 Refund are built, with E5 and E8, and migration 012 IS
APPLIED (advisor run straight after per rule 3: neither cancel_order nor
record_refund appears in the "Public Can Execute SECURITY DEFINER" findings,
and `refunds` is not in the "RLS enabled no policy" list, so both the REVOKEs
and the policy took).

012 ADDED THE TABLE THESE SCREENS NEEDED. The schema could record that a
refund had happened and nothing else: payment_status has 'refunded' and
'partially_refunded', with no amount, no date, no actor and no link to the
Stripe object. So "partially refunded" meant "some unknown amount, at some
unknown time, by someone", a second partial refund had no way to know what
the first had already sent, and A16's typed-amount confirmation would have
been theatre — the number typed would have been discarded the moment it was
used. `refunds` is what makes the over-refund check possible; Stripe
refusing an over-refund is why it was never a live bug, and relying on the
payment processor as your integrity constraint is luck, not a control.

ORDER OF OPERATIONS IS THE OPPOSITE OF /ship's, deliberately. ship_order
wrote the database first because the parcel had already gone. Here the
irreversible act is Stripe's and has not happened yet, so Stripe goes first:
of the two failures available, an unrecorded refund is recoverable (Stripe is
the source of truth, charge.refunded still fires, and the route writes an
audit row naming the orphaned refund id) while a refund recorded but never
sent is not — staff see it settled, stop looking, and the customer is simply
out the money. Both dialogs also send an idempotency key generated when they
open, because a double-click on a refund button is otherwise two refunds.

Narrowings, all for the same root cause — payments.card_brand/card_last4
exist and the webhook never writes them: "refunded to the Visa ending 4242"
becomes "the card that paid" in A15, A16, E5 and E8 alike. That is now the
fifth screen narrowed by this one missing webhook write and is worth closing.
Two more: A16's "Refund part of it — CHOOSE LINES, or enter an amount" keeps
the amount and drops the lines (there is no line-level refund anywhere, and
tick boxes that silently collapse to a sum would claim a precision the record
does not keep); and E8 is drawn as the refund at the end of a RETURN
("REFUND RET-4471", per-garment rows, "you asked to return part of an
order"), which is not what A16 does — it is headed with the order number, has
no per-line rows, and says the true reason the email arrived.

THIS IS THE FIRST THING IN THIS PROJECT EVER EXERCISED AGAINST REAL DATA.
Both functions were run on the live project with a throwaway fixture: a
partial refund (order and payment both to partially_refunded, stock
untouched), the over-refund guard, a zero amount, a blank reason, a duplicate
Stripe refund id, the full refund with restock (stock 10 -> 12, one
inventory_adjustment, correct audit rows), cancellation with restock (12 ->
14), cancelling an unpaid order (payment_status left alone, no refunds row,
audit says "nothing to refund"), and cancelling a shipped order. Every guard
fired with the message it was written to give.

THE FIXTURE IS GONE — the owner ran the cleanup, and it is verified: zero
fixture products, variants, orders, order_items, payments, refunds and
inventory_adjustments, and both zz_try_* helper functions dropped. The
advisor is back to the pre-012 baseline exactly (is_staff/is_owner, citext
in public, rate_limits/webhook_events having no policies, leaked-password
protection off — all deliberate or owner-level).

FOUR audit_logs ROWS REMAIN AND SHOULD. audit_logs is append-only, enforced
by the forbid_audit_mutation triggers, so dropping that guard to tidy up
four rows naming ZZ-TEST-012-A/B/D would defeat the one property the log
exists to have. That they could not be deleted is the guarantee working.

WORTH CARRYING FORWARD ABOUT THE TOOLING: this environment's Supabase MCP
gates DELETE and DROP behind an interactive confirmation that never arrives
in a session — execute_sql and apply_migration both time out on them,
including on a DELETE matching no rows, which is what proved it was the gate
rather than a lock or a bad predicate. Plain DDL (create table, alter table,
create index, create or replace function) goes through fine. Plan migrations
to be additive; anything needing a DROP has to go to the owner, which is why
014's refund_return wraps record_refund instead of replacing it.

Still open from this chunk: the Stripe webhook's charge.refunded branch only
half-covers a refund issued from the Stripe dashboard rather than our admin —
payments.status moves, but no refunds row exists, orders.payment_status stays
'paid' and nothing is audited. Calling record_refund from the webhook closes
it, and the unique index on refunds.stripe_refund_id already makes doing it
twice safe. Noted in the handler.

The admin side of returns is built: A17 Returns (143:2093/143:1924/143:1783,
all three pulled — structurally A11, table above 768, record list below, rail
at 1440) and A18 Return details (144:2278 Desktop pulled, 144:2056 Tablet
checked by screenshot — ONE breakpoint at 1440, stacking in the frames' own
order, and no Mobile frame so it sits behind WideOnly).

THE E7 NAMING KNOT IS SETTLED, by the artwork rather than by guessing. The
ledger's id map calls 165:42 "E7 Return approved" while its decisions list
says "E7 sends when the refund has actually left (A16), not on approval
(A18)" — which read as a contradiction until the frame was opened. Its own
canvas note is the tie-break: "Approval and refund are separate events in the
admin (A18 then A16), so this email is only sent once the money has actually
left — never on approval alone", and the body says "Your refund has been
sent." So the NAME describes the outcome being communicated, not the trigger.
E7 and E8 are one moment — money leaving — told two ways: E7 when a return is
behind it, E8 when it is a plain order refund. Still worth confirming the
naming with the design owner, because the id map reads as a contradiction on
its own. A consequence worth knowing: APPROVAL SENDS NO EMAIL AT ALL, so
between E6 and E7 the customer hears nothing while the parcel travels,
arrives and is checked. That is the design as drawn, not an omission.

Migrations 013 (links) and 014 (actions) ARE APPLIED, advisor run after per
rule 3 — receive_return, decide_return and refund_return are all absent from
the SECURITY DEFINER findings. 013 added the two links A18 needed:
`refunds.return_id`, without which there is no way to choose between E7 and
E8; and `inventory_adjustments.return_item_id` with its own exactly-once
index, because restock_for_order is whole-order and A18's whole point is that
restock is PER ITEM. The order-level index (order_id, variant_id, kind) could
not be reused — two partial returns on the same order can both legitimately
restock the same variant, and under that index the second would be silently
swallowed — and it must not be weakened, since it is what stops a replayed
Stripe webhook decrementing twice.

TWO THINGS THE TOOLING FORCED. First, `record_refund` could not simply gain a
p_return_id: adding a parameter changes a function's identity, so it needs a
DROP first, and this environment's Supabase MCP gates DROP behind the same
confirmation that never arrives for DELETE (a DROP-containing migration timed
out and applied nothing). `refund_return` wraps record_refund instead, which
is the better shape anyway — the money logic stays in one place. Second, the
advisor briefly flagged `zz_try_cancel` and `zz_try_refund`, the two helper
functions from the 012 test run, for a mutable search_path — the owner's
cleanup dropped them and that finding has cleared.

A18 DEPARTS FROM THE FRAMES ON ONE THING AND ADDS ONE. The frames draw
Approve as enabled while the badge still reads "On its way to us", but
approving applies the restock, and putting stock back for a parcel nobody has
opened is how the shop sells a T-shirt still in a van — decide_return refuses
it and the screen agrees. The design's own Refund panel already applies that
bar one step later ("available once the parcel is marked received and
checked"). Added: MARK RECEIVED, which no screen in the file draws, although
`received` is a real status with a real received_at column and A18's progress
list has a "Checked at the atelier" step — without it nothing could ever be
approved. Raise both with the design owner.

Omitted from A17/A18, each for its own reason: "Export returns" (no route, no
format — same as A11's "Export orders"); the footer's "escalated on the
dashboard" (there is no dashboard and nothing escalates, so it says what
actually happens and the Age filter is what makes the 5-day rule usable);
"View customer" (no customer page, same as A12); the internal-note field (no
notes table, same as A12 — though the refund's note is real and goes to the
audit log); and "Return postage — Free, drop-off" plus the "Label issued ·
valid until 24 September" progress step, because nothing issues a label,
charges for one or records how the parcel travelled. `label_expires_at`
exists and is never written. E9 narrows one promise for the same reason: "we
are posting it back to you at our cost, it should arrive within a week" is a
parcel nobody has arranged, so it says the item is being sent back and that
we will write with the details — keeping the design's principle (we do not
keep the goods) without committing to a timescale no system tracks.

A03 T-shirts and A07 Inventory have now had the pass too (128:645/128:430/
128:259 and 128:1220/128:1033/128:874). Both predated the admin shell and
had never been matched to their frames at all — bare tables with a
display-font h1, no top bar, no toolbar, no footer and no record list, so a
phone squashed four or five columns into 390px rather than stacking.
Verified at 390/768/1440: table hidden and record list shown below 768, no
horizontal page overflow at any width.

Three things found while rebuilding them, each worth keeping:

 - A07's FOOTER REPEATED THE A01 OVERCLAIM. Both the design (128:1413) and
   the shipped page said "every manual change needs a reason and is written
   to the audit log". The reason is real; the audit log is not —
   adjust_stock writes to inventory_adjustments and nothing else
   (010_adjust_stock.sql:64). Narrowed to the true thing. That is twice this
   project has shipped the same false claim about audit coverage.
 - `sold_out` is Danger in A03, not Attention, and the shipped badge map had
   it as Attention. Matched to the frame.
 - Two filters cannot be database queries and say so rather than pretending:
   A03's "lowest stock" sorts by a sum over variants, and A07's "needs
   attention" compares stock_quantity against each row's own
   low_stock_threshold, which PostgREST has no syntax for. Both are applied
   to the fetched page and the footer states it.

Omitted from both, for the usual reason: "Import CSV" (A03) and "Export CSV"
(A07) have no route and no format, the same call A11 makes on "Export
orders". A07's "Adjust stock" top-bar button is not reproduced either —
adjusting stock means choosing a variant first, and A08 already owns that
form, so a global button would either be a dead end or a second caller of
adjust_stock to keep in sync.

A02 Dashboard is built (126:555/126:309/126:76, Desktop pulled and Mobile
checked by screenshot) and lives at /admin, which until now 404'd — the
rail's first item pointed at a page that did not exist, and A17's footer
referred to an escalation "on the dashboard" that had nowhere to be. The
rail now carries it, with an `exact` flag on the nav link: /admin is a
prefix of every other admin route, so the existing prefix rule would have
lit Dashboard on every screen alongside the one you were actually on.

All six §9.1 figures read real columns, and ONE OF THEM ONLY BECAME
COMPUTABLE WITH 012: "paid revenue today, net of refunds" needs an amount,
and before `refunds` existed payment_status recorded only that a refund had
happened. It subtracts every refund issued today including those against
older orders — which is what "net of refunds" has to mean to reconcile with
the bank, and which means a quiet day with a large refund shows a NEGATIVE
figure. That is correct, and the sub-line explains it rather than leaving a
number nobody can account for.

Low-stock is counted in JavaScript for the reason A07 gives — it compares
two columns — and the metric grid is a departure worth knowing: the frames
draw six fixed 340px cards that wrap, this uses equal fractions so the cards
run wider at 1440 rather than leaving a ragged gap at the end of each row.
The column COUNT matches the frames at every breakpoint (1 / 2 / 3), which
is the part carrying the layout; verified at 390/768/1440.

A23 Audit log is built (146:3635 Desktop pulled; 146:3454 Tablet is the
same screen narrower) and is in the rail. It has NO Mobile frame, which is
a counterexample to the read-vs-write rationale written into
wide-only.tsx — this is a read screen. It is not gated anyway: every entry
is a stacking block of text with no table to squash, and refusing to show
an append-only log on a phone withholds the one screen you reach for when
something has gone wrong away from a desk. One more reason to settle that
rationale with the design owner.

THE DESIGN DRAWS EIGHT EVENT TYPES AND THE SYSTEM WROTE FOUR AND A HALF —
and this file attributed that list to §9.6, which does not contain it.
CORRECTED: §9.6 is "Returns and refunds" and its only audit sentence is
"Refund, cancellation, product archive and negative stock adjustments
require explicit confirmation and audit logging"; §12 adds "Audit refunds,
cancellations, fulfilment and inventory changes". The eight events — and
the six-year retention A23's own footer promised — come from the FRAME's
entry list (146:3732 onwards), not from the spec. Worth knowing before
treating any of them as a requirement. See the audit-coverage entry below
for what closed.

MIGRATION 015 IS APPLIED (advisor clean, adjust_stock still absent from the
SECURITY DEFINER findings so the REVOKE held across the `create or
replace`). It makes adjust_stock write an audit row. This project shipped
the claim that stock changes are audited TWICE — the A01 small print
(corrected in 1d4059a) and A07's footer (corrected in d762e61) — so making
it true was cheaper than retracting it a third time. The signature is
unchanged on purpose: a p_actor_label parameter would change the function's
identity and need a DROP, which this environment's tooling gates, so the
label is read from `profiles` inside the function. That is better anyway —
the label cannot then disagree with the profile it names.

Entity ids are resolved to order and return NUMBERS with two batched
lookups, because audit_logs stores only an id. Where the row it described
is gone the entry says so rather than printing a uuid — append-only means
an entry outlives its subject, which is the point, and four of the five
rows in the live log are exactly that case.

A19 Customers and A20 Customer details are built (143:2465 Desktop pulled,
143:2276 Tablet checked by screenshot; 144:2696 Desktop pulled, 144:2514
Tablet checked by screenshot), which closes the "View customer" dead end
A12 and A18 both had to omit. A19 is structurally A11 — rail at 1440,
table at 768. A20 has ONE breakpoint like A12/A13, and its side column is
340px, A13's width rather than A12's 380. Verified at 390/768/1440.

CUSTOMERS IS NOT A TABLE AND NEVER WAS, which is the whole reason this
needed migration 016. A customer is a `profiles` row OR an email that
ordered without one, and A19's five data columns are an aggregate over
`orders` grouped by email — no GROUP BY, no UNION and no window function
is expressible through PostgREST, and reducing every order in JavaScript
would make search, sort and pagination lies as soon as there is more than
one page. `admin_customers()` does it in Postgres. It is also the only way
to answer the ACCOUNT column at all: Verified/Unverified needs
auth.users.email_confirmed_at, which `authenticated` cannot read and a
security_invoker view cannot reach. Narrowing the column to
Registered/Guest was the alternative and would have been hiding data we
hold. 017 adds `admin_customer_stats()` for the subtitle's two whole-shop
figures, separate only because 016 was already applied and migrations here
are never edited once they have run.

EMAIL IS THE IDENTITY, lowercased everywhere. The columns are citext so
the database already matches case-insensitively, but the UNION is over
text, and 'Jordan@x.com' on an order beside 'jordan@x.com' on a profile
would otherwise split one person into two rows — a "guest" holding the
orders and a "verified" holding none. That is exactly the failure A19's
own footer warns about. A20 is keyed on the email too, so it opens for
someone who has never registered.

THESE THREE FUNCTIONS ARE THE FIRST READ PATH IN THE ADMIN THAT BYPASSES
RLS. Everything else here reads with the signed-in user's own session, so
`is_staff()` inside each policy is the real lock and the layout only
decides what renders. service_role has no auth.uid(), so the check cannot
live inside the function — it moved to the front of the page as
`requireStaffPage()` (lib/admin/require-staff.ts, beside the route-handler
version). A layout is not a security boundary; one future route group that
forgets to nest would otherwise be a full customer-list leak. Rule 3 is
otherwise unchanged and the advisor was run after both migrations:
admin_customers, admin_customer_account and admin_customer_stats are all
absent from the SECURITY DEFINER findings, and the baseline is exactly
what it was (is_staff/is_owner, citext in public, rate_limits and
webhook_events without policies, leaked-password protection off).

016 also adds `addresses_staff_read`. `addresses_own` was the ONLY
customer-owned table with no `or is_staff()` anywhere — orders, returns,
order_items, payments, fulfilments and profiles all have one — so A20's
SAVED ADDRESSES card could not have been filled. Additive: the existing
policy is untouched and a SELECT policy ORs with it.

BOTH LIST FUNCTIONS WERE EXERCISED AGAINST THE LIVE DATABASE, read-only,
and the numbers reconcile: 2 people, 1 a repeat buyer, 0 guests; three
PAID orders totalling GBP 446.85 against the owner's own address, last one
4 October 2026. (The order count has moved again — CLAUDE.md recorded 5
orders of which MC-10006 was the only proven one; three of them are now
paid. The owner is still adding data.) Every filter and sort fired: guest,
verified, country GB and IE, case-insensitive search on both name and
email, all four sorts, and an offset page. admin_customer_account returned
the right row for a mixed-case, space-padded email and a correctly empty
one for an address nobody has used.

LIFETIME SPEND IS DEFINED ONCE AND STATED: orders that were actually paid
for, at what was charged, NOT net of refunds. A pending order is an
abandoned checkout, and counting it would show "3 orders, GBP 0.00"
against someone who has bought nothing. That is a different question from
A02's "paid revenue today, net of refunds", and the footer says which this
is.

Omitted from A19: "Export customers", the same call A11 makes on "Export
orders" and A07 on "Export CSV" — no route, no format, no decision about
columns. The design's Germany row goes too: checkout restricts shipping to
GB and IE, so the Country filter offers the two that can exist rather than
a list that can never match.

A20 DOES get an export, and the difference is the point: one person's data
in an obvious format with a one-month statutory deadline is not the same
ask as a bulk customer CSV nobody has specified. GET
/api/admin/customers/[email]/export returns the profile, saved addresses,
orders with their items, returns with their items and refunds as a
downloadable JSON file, scoped to one email and no-store. JSON rather than
CSV because the data is nested and flattening it would lose which item
belonged to which order.

Three A20 narrowings, each for a missing column rather than a missing
screen. "Delivery updates by SMS" is omitted: no SMS consent column exists
and nothing sends a text, so an "Off" row would be precisely the consent
record the card's own footer says not to create. "Erase this profile" is
omitted as an ACTION and kept as an explanation: deleting a profile
cascades to addresses and sets orders.profile_id null, so a careless
delete quietly turns someone's order history into guest orders — erasure
has to null the person out while the sales history stands, which is a
migration nobody has written. And "Email this customer" IS real: a mailto,
because nothing in this app sends staff email. Contact preferences stay
read-only exactly as the ledger requires.

COLLECTIONS ARE DONE, AND THE ORDER MATTERED. Pulling A09 and A10 first
showed that both describe a storefront this app did not have: there was no
collection page anywhere, no /collections, and `collections` was read in
exactly two places as a filter facet and a card label. `position`,
`hero_path`, `hero_alt`, `seo_title` and `seo_description` were written by
nothing and read by nothing, so an editor for them would have been a form
whose every field reached no reader. The storefront half was built first.

SCREEN 19 — the collection page (121:5606 Desktop pulled, 121:5514 Tablet
and 121:5428 Mobile by screenshot) — now lives at `/collections/[slug]`,
which is exactly the address A10's handle helper promises. The ledger calls
it 03 Product Listing cloned, so it REUSES the rail, sheet, sort control
and product card rather than copying them; all four took a `basePath`, and
the Collection facet disappears by passing an empty option list (Group
already returns null for no options) rather than by a special case. There
is also a `/collections` index, which has no frame and is built anyway for
the reason track-order was: the site header has linked "Collections" there
since the chrome was built and it 404'd. Verified at 390/768/1440: hero
200/320/440, grid 2/3/4, discovery bar below 1440 and rail at 1440.

Two of screen 19's four metadata fields are real and two are not. RELEASED
is collections.published_at; STYLES is a real count. RUN ("Limited — not
restocked") has no backing column, and a shop promising never to restock is
the one claim a customer disproves by coming back in a month. MADE is real
as products.made_in but is PER PRODUCT, so it shows only when every product
in the collection agrees — otherwise one origin gets claimed for all of
them.

A09 and A10 are built on top of that (145:2426 and 145:2762 Desktop pulled;
145:2294 Tablet by screenshot), both behind WideOnly. Four routes:
POST /api/admin/collections, PATCH .../[id], PUT .../[id]/products and
POST .../reorder.

THE ADMIN BREAKPOINT DECISION IS RECORDED AFTER ALL, and this file said it
was not. design-system-state.json's `admin_breakpoint_decision` carries it,
taken by the owner on 10 September, and wide-only.tsx has been corrected.
Two things in it are worth knowing. The rule names the exception list
exactly — 390 is built only for Dashboard, Orders, Order detail, Returns
queue, plus Sign In, T-shirts and Inventory — and sixteen screens are
listed no_mobile including A09, A10, A19, A20 and A23. And the REASON is
density, not the read-vs-write line this project inferred from counting
frames: "dense tables and multi-section editors fight a 390px screen".
That matters because it is a statement about what the DESIGN covers, not a
ban on a page working at 390 — which is why A19 and A23 still render a
stacking list there rather than a gate, and why A09/A10 do not.

THE DESIGN AND THE DATABASE DISAGREE ABOUT HIDDEN COLLECTIONS, and the
database wins in the code. A09's footer says hiding one takes it out of the
menu "but its page stays reachable by its address, so links you have
already shared keep working". The RLS policy is `status = 'live' or
is_staff()` (002_rls.sql:88), so a hidden collection returns no row to a
customer and its page 404s. Both behaviours are defensible; changing a
security policy to match a sentence in a footer is the wrong way round. The
note says what the system does. FOR THE DESIGN OWNER — it is a policy
change, not a copy change. Two more for the same list: the "menu" the
design keeps referring to does not exist (the header has one static
Collections link, not a list built from the table), so A09's subtitle and
its "Hidden from navigation" row are narrowed to the collections page and
the shop; and screen 19's DESKTOP frame drops the sort control that its own
Tablet and Mobile frames draw and 03A keeps, which would remove a control
only where there is most room for it, so sort stays.

SCHEDULING IS HALF A FEATURE AND A10 SAYS SO. `scheduled` is a real status
with a real date and the storefront honours it — RLS shows only live, so a
scheduled collection is genuinely invisible. Nothing FLIPS it to live when
the date arrives: no cron, no scheduled function. The design's "Scheduled
1 Oct, 09:00" implies a system that publishes for you. The panel records
the date, shows it, and says plainly that someone has to come back and set
it live. Closing it needs a scheduled job.

Omitted from A10: "Replace image" and "Remove" on the hero, the same
upload-pipeline gap that leaves A05 unbuilt and every product card a well.
ALT TEXT IS KEPT AND IS REAL — hero_alt is a column, screen 19 reads it,
and writing it now means the photograph arrives already described. "View on
the site" is kept and now goes somewhere, which it would not have a commit
earlier. A new collection starts Hidden, not Live: creating something and
having it hit the shop the same second, before it has a description or a
single T-shirt, is the one default that cannot be undone quietly.

TWO ACCESSIBILITY ADDITIONS THE FRAMES DO NOT DRAW. Both drag lists — A09's
collections and A10's products — carry real Move up / Move down buttons at
44px beside the "::" handle. A drag-only control cannot be operated from a
keyboard at all, which would make the one thing those screens exist for
unreachable; same reorder, same endpoint.

THE MEMBERSHIP ROUTE'S TWO WRITES ARE ORDERED ON PURPOSE, the same
reasoning as /refund's. No transaction is available (rule 4), so of the two
half-failures: upsert-then-delete leaves EXTRA members, visible and fixed
by saving again; delete-then-upsert leaves the collection EMPTY with
nothing saying what used to be in it. Upsert goes first, and the delete is
expressed as "not in this list" rather than a clear-and-re-add, so rows
that stay are never gone even for an instant. Rule 4 would put this in a
Postgres function and that is still the better home; it is recoverable as
written, which the alternative is not. The reorder route needs no such care
— a half-applied reorder loses nothing and the next drag fixes it.

Verified against the live database read-only, because DELETE is gated in
this environment and test rows could not be cleaned up: product_collections'
primary key is `(product_id, collection_id)` in that order, which is what
the upsert's onConflict names, and collections_staff_write and
product_collections_staff_write are both ALL policies. THE WRITE PATHS
THEMSELVES ARE UNEXERCISED — there are no collections in the live database
at all, so /collections renders its empty state and A09 its own. Creating
the first one is the test.

A22 STORE SETTINGS IS BUILT, AND IT FOUND A REAL GAP (146:3214 Desktop
pulled, 146:2988 Tablet; no Mobile frame, so WideOnly). This is the first
admin screen that changes what a customer is CHARGED, and it is OWNER
ONLY for that reason — every other write here is gated on is_staff(),
which is right for packing a parcel and wrong for pricing a basket. A22's
own staff card draws the line in the same place ("Staff — orders,
fulfilment and returns, no settings"). is_owner() has existed since 002
and nothing had ever used it.

CORRECTED: this file said "the check lives in the route, not in RLS:
store_settings has only a staff write policy, and narrowing it is a
migration worth doing". BOTH HALVES WERE WRONG, and pg_policies on the live
database settles it — the table has exactly two policies,
`store_settings_public_read` (select, true) and `settings_owner_write`
(update, `using (is_owner()) with check (is_owner())`). There is no staff
write policy on it and never was; 002_rls.sql:136 put the owner gate in the
database on the day RLS was written, under its own "owner only" heading. So
the migration that was "worth doing" had been done before the note claiming
otherwise was written, and the route's comment repeated the same error.
Both are corrected. The route check stays, and is worth keeping for a
sharper reason than defence in depth: RLS refuses a non-owner staff caller
as zero rows matched, which the route reads as a missing singleton row, so
without the 403 the error would tell someone the database was broken when
their account is simply not an owner.

THE DELIVERY PRICES WERE HARDCODED. free_delivery_threshold_pence was a
column checkout read; the prices beside it were two integer literals in
app/api/checkout/route.ts (`next_day ? 695 : subtotal >= threshold ? 0 :
395`). So the owner could change WHEN delivery became free but not what it
cost, and £3.95 needed a developer and a deploy. MIGRATION 018 adds
delivery_tracked_48_pence and delivery_next_day_pence, defaulted to
exactly the literals they replace, and the checkout route reads them in
the same commit — a column nothing reads would only be a third place for
the price to disagree with itself. Verified on the live project: the
defaults came out 395/695 (so no price moved), a write round-trip
succeeded, and a negative price was rejected by the check constraint with
the row unchanged. That is the first write this project has exercised
against store_settings.

Checkout gained two other things with it. It no longer falls back to a
hardcoded threshold when the settings read fails — it returns 503, because
pricing a basket off a default nobody chose is migration 008's mistake with
money instead of a returns window. And MAINTENANCE MODE IS WIRED: the
column has existed since 001 and nothing had ever read it, so checkout now
refuses with a 503 and a plain message while the storefront stays
browsable, which is exactly what the design's card promises. The bag
surfaces the route's own error text, so the customer reads "the shop is
paused for maintenance" rather than meeting a dead button.

OF store_settings' NINE SETTINGS COLUMNS, SEVEN HAVE READERS and two do
not — this line said "six" and "three" while listing seven, which counting
them against the live table settled. Live: free_delivery_threshold_pence,
the two delivery prices, return_window_days, vat_rate_basis_points,
contact_email, maintenance_mode. Unread: collection_fee_pence (nothing
applies it to a refund) and from_email (emails send from the EMAIL_FROM
environment variable, because Resend will only send from a verified
domain, so the address and the deployment have to agree). The table has
eleven columns in all; `id` and `updated_at` are bookkeeping.

A22 OMITS MORE THAN ANY OTHER SCREEN, because the design describes a
settings table this shop does not have. STORE DETAILS entirely — trading
name, registered address, company number, VAT number, none of which are
columns, all of which are legal footer/invoice content already waiting on
legal review. The Ireland and Rest of Europe delivery rows (delivery_method
is an enum of exactly two values and checkout ships GB/IE only; a
per-country rate table is a feature, not two more columns). The collection
fee, for the reason above — a number recorded and ignored is the one shape
of field this project keeps refusing. Condition rules (no column; the
wording lives in the returns page and E6, and one source for both is worth
doing properly). Both tax tick boxes — prices here are VAT-inclusive
throughout, which is what UK law requires and what every total assumes, so
a switch implying you could turn it off would be the most expensive wrong
tick on the screen; and nothing collects duties because nothing ships
beyond GB/IE. The Stripe account id and payout schedule (not stored, and
reading them would mean a live Stripe call on an admin page load). And
"Invite someone", because there is no invite flow — deliberately.

The staff list IS real, read from profiles. The return window will not go
below 14 days in the form, which is the UK statutory minimum and something
the database's own `> 0` check cannot know.

THE HOMEPAGE IS BUILT (02A 38:190 Desktop pulled, 36:93 Tablet and 28:2
Mobile by screenshot), which replaces a fourteen-line placeholder that
said the storefront was under construction — untrue for some time, with
shop, product, bag, collections, auth and order tracking all live behind
a front door that still apologised for them.

It is also what unblocks A21, the last admin screen, by the same rule
Collections taught: `homepage_sections` (key, content jsonb) had existed
since 001 and NOTHING read it, so an editor for it would have been a form
writing to a table no page consults. `lib/home/sections.ts` is the reader.
It holds the SEVEN §9.7 slots — announcement bar, hero campaign, featured
drop, featured T-shirts, brand/craft story, newsletter text, delivery and
return highlights — each with a full default, so the page renders the
designed copy against an empty table and A21 only ever overrides. Section
order, featured count and layout are FIXED, which §9.7 is explicit about
("a limited content system, not a general page builder") and which A21
must say rather than imply otherwise. The Fit and size guidance block is
deliberately NOT a slot: §9.7 does not list it, so its copy stays in the
page.

THE ANNOUNCEMENT SLOT USES A {threshold} TOKEN, and that is the whole
reason it is safe to make editable. The Announcement Bar's own component
description warns that the figure quoted there must match Store settings
and that nothing validates it; today the bar DERIVES the number so the two
cannot disagree, and plain free text would trade that guarantee away. The
token keeps both — write any sentence, and the number in it is still the
one checkout charges against. It lives in lib/home/tokens.ts rather than
sections.ts because the bar is a client component and sections.ts is
`server-only`.

Two homepage copy departures, both narrowing. "On orders over £150,
tracked with DPD" loses DPD: no carrier is configured anywhere (A14's
carrier field is free text for exactly that reason) and naming one on the
homepage would be the shop's most public unverifiable claim. "14-day
returns" becomes "Returns", because the design's number and the seeded
store_settings value (30) disagree and the homepage is the wrong place to
settle it — whatever request_return() enforces is the real window, stated
where someone is actually deciding. The design's "Open the size guide"
points at screen 23, which is unbuilt, so it links to the shop; the
measurements are owner-blocked anyway (§8.5).

The featured T-shirts are real products with real labels — New, Limited
Edition, Low stock derived exactly as the shop listing derives them. When
featured_products names slugs they are used IN THAT ORDER (`.in()` does
not preserve it, and the order is the curation); when it is empty, which
it is today, the four most recently published stand in so the section is
never blank mid-curation.

Verified at 390/768/1440: hero column then row with the image 360/520/720,
hero title 40/52/72, section title 30/42, craft headline 28/40 (40 at
Desktop, not the section title's 42 — read off 39:266), drop grid 2/2/4
(NOT the shop listing's 2/3/4, so it has its own class), craft and
reassurance stacking below 768, no overflow at any width. ONE BUG CAUGHT
BY MEASURING rather than by eye: the hero well had `flex: 1 0 0` for the
row layout, and below 768 the hero is a COLUMN where flex-basis is the
height — so a 360px well rendered 16px tall, its label and nothing else.
The flex only applies from 768 up now.

A21 STORE CONTENT IS BUILT (146:2755 Desktop pulled, 146:2536 Tablet;
no Mobile, so WideOnly), WHICH COMPLETES THE ADMIN — 23 of 23 screens,
and the rail now carries every item the design draws instead of the three
it started with. The form is seeded from buildHomeContent(), the SAME
function the homepage renders through, so the fields show exactly what a
customer is seeing, defaults included; publishing is what turns a default
into a stored row. PUT /api/admin/content writes all seven slots in ONE
upsert rather than seven requests — a half-published homepage (new hero,
old reassurance) is the failure worth avoiding, and an array upsert is as
close to atomic as this gets without a function. Staff, not owner-only:
A22 is owner-gated because those columns price a basket, while homepage
copy is the job the shop's own people do and the worst case is wording
somebody can change straight back.

Verified read-only: homepage_sections' primary key is `key`, which is
what the upsert's onConflict names, homepage_staff_write is an ALL policy
and homepage_public_read is SELECT, so the storefront reads it as anon.
The write path is unexercised — the table is empty, which is the normal
case the defaults exist for.

FOUR A21 DEPARTURES, each closing a hole rather than opening one. The
hero's "Button goes to" stays a SELECT of real destinations (the shop,
the collections index, each LIVE collection — a hidden one's page 404s,
so offering it would be offering a broken link) and the route rejects
anything else: free text would put a 404 one typo away on the busiest
button in the shop. The hero image is shown and not editable, the same
upload-pipeline gap as everywhere else. Each reassurance highlight gets
TWO fields rather than the design's one, because the homepage draws a
title and a supporting line and the page is what customers read. And the
craft specification rows ARE editable although A21 does not draw them —
"240 GSM", "100% combed cotton" are the most falsifiable claims on the
homepage, and leaving them in code would mean only a developer could
correct one.

Two homepage corrections went in with it. The story section's "Read the
story" is GONE: it pointed at /our-story, which does not exist — the site
header already links there and 404s, and a second dead end from the
homepage would compound that rather than match the design. And the hero's
eyebrow is no longer its own field: both frames use the featured drop's
words in both places, so it reads from that slot and there is one fewer
thing to keep in step. The newsletter slot now feeds the FOOTER, which is
on every page, making it the widest-reaching slot rather than a homepage
one; and the announcement slot gained `visible`, which is A21's "untick to
hide it everywhere without losing the text" — a legitimate checkbox by the
component's own rule, unlike A14's locked send row.

Then: the remaining seven Resend templates (`lib/email/layout.ts` has the
shared chrome — reuse it rather than duplicating table markup per template).
E1/E2 (verify email, password reset) now have a caller — Supabase Auth sends
its own default email today; routing that through our Resend templates
instead needs a Supabase Auth "send email" hook, a dashboard-level setting,
not application code — flag it for the owner rather than guessing at hook
config against the live project. E4/E5/E7 need the admin order actions
(dispatch, cancel), E8 needs the admin refund action, E9 needs the admin
return decision — build each template alongside the route that triggers it,
the way E3 and E6 went in — E4, E5, E7, E8 and E9 have all gone in that way
now, so only E1/E2 are left and both are owner-blocked. Also still open: homepage
content (A21, blocked on a real homepage — see above), and the
customer-facing account pages (profile, addresses, signed-in order history
— now unblocked the same way the catalogue was, since they need auth,
which exists). The catalogue, bag and guest order
lookup+return (`app/shop/`, `app/bag/`, `app/track-order/`) are now
matched against their real Figma screens, not just built — but each still
carries disclosed, deliberate gaps (cart stays localStorage; the
photography and the side-panel/bottom-sheet confirmation have since been
closed — see A05 and 05G/H/I below) — see README's
"What is not here yet" for exactly which parts of §8.2/§8.4/§8.7 are
deferred and why. `app/track-order/` has no order detail page of its own
(13 Order Detail) — everything it shows lives on the one lookup-result
page, reusing that screen's own content rather than a generic summary.

A05 PRODUCT IMAGES IS BUILT AND SO IS THE PIPELINE UNDER IT, which is what
every "no photography exists" note in this file was waiting on. MIGRATION
019 IS APPLIED: one public `shop-images` bucket (10 MB, four image mime
types) separated by path prefix rather than three buckets with three
identical policy sets, four storage policies (public read; staff insert,
update and delete gated on is_staff()), and a unique index on
`product_images (product_id, position)` — the index is what makes position
mean something, and it is why the reorder route stages negative positions
before writing the real ones rather than colliding with itself.

THE FILE NEVER PASSES THROUGH THIS APP. POST /api/admin/images/sign hands
the browser a one-shot signed upload URL and the browser talks to Supabase
directly: a route that accepted the bytes would meet Vercel's 4.5 MB body
limit, pay for the bandwidth twice and bill the upload as function time.
The PATH is chosen server-side from a uuid and the declared type, never
sent by the client — a client-supplied path is a client-supplied place to
write — and `isShopImagePath` is the one shape anything stored here may
have. The sign URL is created with the CALLER'S OWN session, not the
service role, so the storage policy gets to refuse as well.

THE READERS ARE WIRED, which is the half that makes an upload visible.
Product cards (shop, collection, homepage featured, related), the product
detail gallery, the collection hero (`collections.hero_path`, now editable
in A10), the homepage hero (a path in the `hero` jsonb slot, editable in
A21 — jsonb because there is no homepage table for a column to live on),
A12's order lines, A13's pick list, A18's return lines, A09's list and
both curation lists. Every one of them falls back to the well it had
before, because a catalogue mid-shoot has photographed and unphotographed
T-shirts side by side.

THE GALLERY SWAPS WITH THE CHOSEN COLOUR, which is the whole reason A05
lets an image be assigned to one. Colour had to move out of AddToBag into
a small wrapper (`product-media.tsx`) that owns it and renders both cells
of 04A's grid, because the gallery and the purchase panel sit in different
cells and the state is shared. An image assigned to no colour (a fabric or
print detail) shows for EVERY colour rather than being uploaded four
times, and a colour with neither its own images nor a shared one shows the
whole set rather than nothing. Order lines use the same rule, for a
sharper reason: the BLACK photograph beside a WHITE line on a pick list is
how the wrong garment goes in the parcel.

Deletion is ordered like /refund's: the ROW goes first and the file after,
because an orphaned file costs storage and a row pointing at a deleted
file is a broken image on the shop. Removing a hero in A10 or A21 clears
the path and leaves the file, for the same reason.

Verified at 390/768/1440 by measuring the live CSS, not by eye: A05 is
gated below 768 (it is on `admin_breakpoint_decision`'s no_mobile list),
one column at 768 and two with a 340px side panel at 1440; the gallery's
thumb rails stay none/tablet/desktop across the three widths with the main
image at 4:5 (350x438, 328x410, 548x685); the collection hero holds
200/320/440 and the homepage hero image 360/520/720 — unchanged from
before the photographs, with every picture filling its box rather than
letterboxed by the well's own padding. No horizontal overflow at any
width. THE WRITE PATH IS UNEXERCISED: this sandbox cannot reach Supabase,
and there are no images, collections or homepage rows in the live
database. Uploading the first photograph is the test.

A05 IS REACHABLE FROM THE T-SHIRT LIST AND WORKS AT 390. Both are fixes
to the same report — "i cant find upload for tshirt images" — and both
were real. The only route in was an "Images →" link INSIDE the product
editor, so the screen was findable only by someone who already knew it
existed; and the editor is WideOnly, so on a phone there was no route at
all and nothing saying why. A03's rows now carry the link and the image
COUNT, with "No images — add photography" in Attention on anything
unphotographed, because "which of these still has no pictures" is the
question that list could not answer and the one thing between this
catalogue and a shop that looks finished.

THE OWNER LIFTED A05's no_mobile GATE on 18 October, and the exception is
recorded in design-system-state.json beside the rule rather than only in a
comment. The photographs are on the phone; gating the one screen whose
input lives on the device you are holding is the gate working against its
own purpose, and the rule's recorded reason is DENSITY, which a thumbnail
grid plus a side panel is not. Measured at 390/768/1440 after ungating:
two thumbnails per row at 390 (138px), four at 768, five at 1440 with the
340px side panel; Move earlier/later stay 44px at every width; no
horizontal overflow. The frames are still Desktop and Tablet only, so 390
here is implementation beyond the design file rather than a frame nobody
built. A05 also gained an "All T-shirts" link, because "Back to product"
lands on A04's gate below 768 and a phone needs a way out to a screen it
can use.

THE WEBHOOK NOW WRITES THE CARD AND RECORDS A DASHBOARD REFUND, closing
two things this file had been carrying as open. payments.card_brand and
.card_last4 had existed since 001 with no writer, which narrowed six
places at once; the paid intent is now retrieved with latest_charge
expanded, best-effort and caught, and A12's Payment panel, A15, A16, E5,
E7 and E8 all name the real card where there is one. Every order placed
BEFORE this keeps "the card that paid" for good — Stripe holds those
details and our row never will. lib/payments/card-label.ts is the single
copy of that fallback wording. And charge.refunded now resolves the order,
lists the charge's refunds from the API and calls record_refund for any
stripe_refund_id we do not already hold, so a refund issued from the
Stripe dashboard stops leaving orders.payment_status on 'paid' with no
refunds row and no audit trail. A refusal writes refund_not_recorded to
audit_logs and still returns 200, because Stripe cannot fix it by
retrying. Track-order is deliberately NOT widened to match: the card is
available there too, and what a guest may read on the evidence of an order
number plus an email is the owner's call.

THE CUSTOMER ACCOUNT CLUSTER IS BUILT — the last unbuilt storefront
screens. /account (11, 100:3082 Desktop + 100:2774 Mobile + 100:2925
Tablet, all three pulled), /account/orders (12, 102:3304 pulled),
/account/orders/[orderNumber] (13, 103:3631 — the node track-order's
result view was already built from, so this is that screen WITH its
account chrome), /account/addresses (30, 106:3719) and /account/details
(18, 107:3945). One AccountShell carries the head, the rail and sign-out,
which is how the ledger says the design was built (every screen is 11
cloned with the content column replaced).

THREE DEAD FOOTER LINKS ARE CLOSED by it: Overview, Saved Addresses and
Account Details had pointed at /account since the chrome was built, and
/account 404'd. The header's Account icon now goes to /account rather than
/sign-in, because the header cannot know whether anyone is signed in and
/account redirects with a ?next= that comes straight back. Sign-in honours
?next= and accepts a PATH ONLY — anything not starting with a single slash
is ignored, since a sign-in form that forwards wherever a query string
says is an open redirect on the real shop's real domain.

RETURNS IS A RAIL ITEM WITH NO FRAME. The rail draws five items on every
screen in the cluster and the file has 17 Return Details but no list in
front of it, so /account/returns is built from the cluster's own grammar
rather than left to 404 — the same call A11 made about the admin items
whose pages did not exist. Worth settling with the design owner: a screen
of its own, or a section of 12 Orders.

MEASURED AT 390/768/1440 rather than eyeballed, and the Tablet pull
changed two numbers a single breakpoint would have got wrong: the page
title steps 32/40/48 (not 32/48) and the rail is 210px at Tablet against
240 at Desktop. Section tiles come out 2/1/3 per row, which is what the
three frames themselves draw; 13's columns split at 1440 with a 320px
side rail; address cards 1/1/2; every nav item 44px; no horizontal
overflow at any width.

MIGRATION 020 IS APPLIED — the owner ran it on 19 October through the
dashboard SQL editor — and it closes a real privilege-escalation hole that
predates this work. profiles_self_write is
`using (id = auth.uid()) with check (id = auth.uid())` — a ROW rule that
says nothing about COLUMNS — and `profiles` holds `role`. The publishable
key is in the browser by design, so any signed-in customer could call
PostgREST directly with `update({ role: 'owner' })` on their own row and
RLS would allow it. Being an admin here is exactly that one column. No
route ever permitted it (every schema that writes profiles is `.strict()`
and does not name `role`, which is why they are strict), but a route is
not the lock. 020 revokes UPDATE on profiles from `authenticated` and
grants it back on full_name, phone, marketing_opt_in and
marketing_opt_in_at only; PostgREST honours column privileges, so the
database refuses it for every caller.

VERIFIED, by the owner's own screenshot of
`information_schema.column_privileges` rather than from this session:
UPDATE on `profiles` returns exactly four rows, every one `authenticated`
— full_name, marketing_opt_in, marketing_opt_in_at, phone — and NONE for
`anon`. `anon` sorts first under that query's own ordering, so an empty
top of the list is the part that proves the second revoke took. So a
customer's own profile row is now writable in four columns and `role` is
not one of them, enforced by Postgres rather than by a route schema.

THE RULE 3 ADVISOR RUN IS DONE and the baseline is unchanged:
rate_limits/webhook_events with RLS and no policy, citext in public,
is_staff/is_owner executable by anon and by authenticated, leaked-password
protection off. Nothing from 020 appears, `profiles` is unflagged, and
NONE of the eleven SECURITY DEFINER functions added since 010 is listed —
adjust_stock, advance_fulfilment, ship_order, cancel_order, record_refund,
receive_return, decide_return, refund_return, admin_customers,
admin_customer_account, admin_customer_stats. Every REVOKE held.

The advisor has a NEW LINT NAME since the last run, "Signed-In Users Can
Execute SECURITY DEFINER Function", beside the older anon one. It names
the same two functions, so it is a new check rather than a new finding —
and both are deliberate for the reason 004_lock_down_functions.sql:20
gives: RLS policy expressions evaluate as the CALLING role, so revoking
EXECUTE on is_staff/is_owner breaks every staff policy in the database,
and they report only on the caller's own role, which the caller already
knows.

WORTH CARRYING FORWARD ABOUT THE TOOLING: the Supabase connector spent
this whole chunk refusing every call — `get_advisors`, `execute_sql`, even
`select 1` — with "You do not have permission to perform this action",
which reads like a project problem and was not one. `list_projects` is
what diagnosed it: the grant was authorised against a DIFFERENT Supabase
account, whose one organisation holds two unrelated projects and not this
one. Tool toggles and a project restart both changed nothing, because
neither is where the grant lives. If this recurs, call list_projects
first and check `afzuhymegntqjwtdkmfb` is in the list before assuming
anything about the database — and never run a query against whatever
projects the wrong grant does expose.

Narrowings in the cluster, each to a column that exists: 18's First/Last
name is ONE field (full_name is one column, and splitting a name on a
space is wrong for a great many real names); its email is read-only with
its real verified state, because changing it is a Supabase Auth flow
nobody has built; the password row claims no last-changed date, since
nothing records one; "Delivery updates by SMS" is omitted for the reason
A20 gives. 13 omits "Cancel this order" (no customer-facing cancel route
— A15 is staff only and issues a refund), "Download invoice" (nothing
generates one) and the billing address (orders.billing_address is still
written by nothing). 30's empty state is reworded: the design says
addresses entered at checkout can be saved here, and nothing does that —
Stripe Checkout owns that form, and the webhook stores a snapshot on the
ORDER so an order's address cannot change when someone later edits their
address book. 12's "Estimated delivery, tracked with DPD" becomes the real
delivery method and the real tracking number where one exists, the same
narrowing the homepage made.

A READ-ONLY PASS AGAINST THE LIVE DATABASE, the first possible in this
chunk, and it rewrote four things this file claimed. The connector reached
the project at last (see the tooling note above), so the queries every new
page makes were checked against the real schema rather than against tsc.

MUCH MORE HAS RUN FOR REAL THAN THIS FILE SAYS. Order MC-10008 went the
whole way on 11 October, by the owner, through the admin: A13 marked it
packed (`fulfilment_packed`), A14 dispatched it with DHL and a real
tracking number (`fulfilment_shipped`), and A16 refunded GBP 99.95 against
a real Stripe refund id (`re_3UMlnP...`) with 2 lines restocked and the
order left at payment_status `refunded`. So advance_fulfilment, ship_order
and record_refund have all been exercised against real Stripe objects and
a real order, not just the 012 fixture — in TEST MODE, like everything
else here (see the correction above; this sentence also used to say "real
money"). The four ZZ-TEST audit rows are still there, as they must be.

A05's WRITE PATH HAS BEEN USED TOO. One real photograph was uploaded on 18
October, and every part of the design held: the stored path is
`products/<product_id>/<uuid>.jpg`, exactly the shape productImagePath()
builds and isShopImagePath() admits, at position 0, assigned to IVORY,
which is one of the product's three real variant colours. So the signed
upload URL, the storage policy, the path guard and the row insert all
work. A21 was used as well — all eight homepage slots carry the same
updated_at to the millisecond (12 October), which is the single-upsert
design doing what it was built for.

THE ALT TEXT ON THAT PHOTOGRAPH IS LOREM IPSUM, live, on the shop's only
picture. The form requires a non-empty description and got one; nothing
can check that a description describes. §13 wants a real text alternative
— worth fixing in A05 before anyone relies on it.

AND A REAL BUG, which is the point of looking. Every one of the five live
orders has `profile_id` NULL, including the ones placed while signed in,
because app/api/checkout/route.ts never set the column — it has existed
since 001 and nothing wrote it. orders_own_read matches profile_id against
auth.uid(), so the ENTIRE account cluster could never have shown an order
to anyone: 12 Orders permanently empty, 13 unreachable, /account's
latest-order card stuck on its empty state. Fixed in the same pass by
reading the user from the SESSION (never the body — a client-supplied
profile_id is a client-supplied claim about whose order it is) and leaving
it null for genuine guests. The order's email stays the one typed at the
bag rather than the account's, because someone may order to an address
they do not sign in with. THE FIVE ORDERS THAT PREDATE THE FIX STAY GUEST
ORDERS; backfilling them by matching email is a judgement call for the
owner, not something to do quietly.

THE FIX IS CONFIRMED IN PRODUCTION. MC-10009 and MC-10010, placed by the
owner on 24 October while signed in as the customer test account, are the
FIRST orders in this project's history to carry a profile_id — every one
before them is null. So orders_own_read can finally match, and the account
cluster has something to show. Both sit at payment_status `pending`: they
reached Stripe and were not completed, which is what pending means and not
a fault. Paying one with a test card is what takes it to `paid` and
exercises the webhook, the stock decrement and the E3 send attempt from a
real browser rather than a harness.

Schema assumptions behind the new pages were checked and all hold:
`addresses_one_default_per_profile` (what the clear-then-set default logic
relies on), `product_images_one_per_position`, `refunds_stripe_key`
(unique where not null — what makes the webhook's record_refund call safe
to redeliver), and every foreign key PostgREST needs to resolve the nested
selects in /account/returns and loadVariantImages.

STILL ZERO: collections and addresses. /collections renders its empty
state, A09 its own, and the address book's write path remains the one
part of the account cluster nothing has touched.

THE CHROME HAS EIGHT LINKS TO PAGES THAT DO NOT EXIST, on every page of
the site, and the first of them is now closed. Counted rather than
assumed: the header's "New Drop" (/drop) and "Our Story" (/our-story),
and the footer's Contact, Delivery, Returns and Exchanges, Size Guide,
Privacy/Cookie Policy, Terms and Conditions and Accessibility. "New
Drop" was repointed at /shop in the account-cluster pass (there is no
drop page because `collections` has no rows, and the homepage's own
featured-drop link makes the same call); the rest were real 404s.

33 DELIVERY AND RETURNS IS BUILT (122:6504 Desktop pulled, 122:6179
Mobile by screenshot), which closes two of them — Delivery and Returns
and Exchanges, the latter as /delivery#returns rather than its old
/track-order, which is where you go to START a return, not to read what
the policy is.

It is built on `components/site/content-page.tsx`, the ledger's
`content_page_shell` — the shared layout screens 23/32/33/34/35 are all
drawn from: a centred content column of FIXED width between the chrome.
Measured at 390/768/1440/1920: the column is 390/768/980/980 and stays
CENTRED rather than stretching at 1920 (which is the stated reason the
ledger calls it fixed), the title steps 38/44/52, the table becomes
stacked cards below 768, and nothing overflows at any width.

EVERY FIGURE ON IT IS READ FROM store_settings, which is the only reason
the page can exist: the two delivery prices, the free-delivery threshold
and the return window are the SAME values checkout charges and
request_return() enforces. A delivery page whose numbers disagree with
the basket is worse than no delivery page, and 018 is what made the
prices readable at all — before it they were two integer literals in the
checkout route. The read throws on error rather than quoting defaults,
the same call checkout makes.

SEVEN NARROWINGS, and six are the same shape as A22's: the design
describes an operation, not a column. The table's four destination rows
become TWO, because checkout ships GB and IE only and `deliveryPence` is
chosen by delivery_method alone — it does not vary by country, so
"Republic of Ireland £9.95" and "Rest of Europe £14.95, duties collected
at checkout" are a price nobody charges, a destination nobody can select
and a duty nothing collects. Then: the 14:00 same-day cut-off (nothing
configures or measures one); "2 to 3 working days"/"Next working day" as
ESTIMATES (nothing computes or records one — A12's timeline omits it for
the same reason, so the page names the real service and promises no
date); the printable label and drop-off QR code (nothing issues a label,
`label_expires_at` is still written by nothing, which A17/A18 record and
E9 already narrows); "a booked collection is £4.95" (collection_fee_pence
is a real column nothing applies to a refund — A22 refused to make it
editable for exactly that reason, and quoting it to a customer would be
the same fiction one step closer to the money); and "we cover the postage
both ways" on faulty items, which keeps the statutory part — a faulty
item is refunded in full, delivery included — without inventing the
parcel. Exchanges keeps the design's words almost intact, because it is
the one section describing something true: there is no exchange
mechanism, and the reason it gives is the honest one.

32 OUR STORY IS BUILT TOO (122:6087 Desktop pulled; 122:5948 Tablet and
122:5815 Mobile measured through get_metadata rather than eyeballed off a
screenshot, which is what gave the exact 240/300/380 story well and the
fact that the three value cards stay STACKED at tablet and go to a row
only at 1440). That closes the fourth of the header's four nav links,
which had 404'd since the chrome was built. Measured at
390/768/1440/1920: well 240/300/380, value cards 1/1/3/3 at 350/704/284
wide, CTA stacked at 390 and a row from 768, quote padding 20/32 and its
display line 28/34, no overflow.

THE COPY IS KEPT AS THE DESIGN WROTE IT, which is the opposite call from
the homepage's and /delivery's and is deliberate. Those pages narrow
claims the SYSTEM cannot keep — a carrier nothing configures, a
collection fee nothing charges. An origin story is not a system claim;
it is the one page whose whole content is the owner speaking for the
business, and rewriting it from here would be inventing a different
company.

ONE SENTENCE IS DERIVED, because it is the only thing on the page the
shop itself can contradict: "three fits — regular, relaxed and
oversized". `products.fit` is a real column and the shop listing builds
its Fit filter straight out of it, so a hardcoded three would sit one
click away from a filter offering something else. The clause reads the
same column the filter does — how many, which, and whether to make the
claim at all — and drops out entirely when no published product has a
fit set, which IS the live state: the one published product has fit,
made_in, composition and fabric_weight_gsm all null. Worth telling the
owner; A04 is where they get filled in.

NOT narrowed, and worth raising with the design owner instead: "Printing
and finishing happen in the UK" and the "Made in the UK" card.
`products.made_in` is a per-garment fact about the blank and the
design's wording carefully separates the two — a blank woven elsewhere
and printed here is honestly both — but a customer reading this page and
then a product's Made in row will take them for one claim.

The story image is the same well every unphotographed surface shows, and
stays one: A05 uploads product photographs and A21 the homepage hero,
but §9.7 is explicit that the content system is seven homepage slots and
not a page builder, so an eighth key in `homepage_sections`, read by a
page that is not the homepage and editable on a screen that does not
draw it, would be worse than the well.

The homepage's "Read the story" is BACK with it (39:259, a real Ghost
Button at the section's own gutter). It was cut when 32 did not exist,
for the reason this file records; the reason has gone.

34 CONTACT IS BUILT (123:6424 Desktop pulled; 123:6261 Tablet and
123:6104 Mobile through get_metadata), and it has ONE breakpoint like
A12: the 320px side column exists only at 1440, and 768 and 390 both
stack the side under the main card in the frames' own order. Measured at
390/768/1440/1920: main card 350/704/532/532, side 320 at 1440 only, the
Already-ordered ghost button flush with its card's copy, no overflow.

ITS FORM IS OMITTED, which is the largest omission any screen in this
project has had. A contact form needs three things and this system has
none of them: no `contact_messages` table or anything like one; no
screen to read a message on, since all 23 admin screens are built and
not one is an inbox; and no email to carry it, because Resend refuses an
unverified sending domain — not a guess, the one thing that actually
failed on MC-10006 and sits in audit_logs as `email_delivery_failed`,
"The domain is invalid". THE THIRD OF THOSE IS NO LONGER TRUE — see the
email correction below; the form is now blocked on two things, not three. A Send message button today would show someone
"thanks, we will be in touch" and drop what they wrote: a real failure
wearing the face of success, the same shape as store_settings having no
row and the catalogue reading a failed query as an empty shop. The
design's own side column already names the channel that works, so the
page leads with it and the reason select and order-number field become
"what to put in it" rather than controls going nowhere. BUILDING IT
PROPERLY is a migration with RLS, an admin inbox the design does not
draw — a feature, not a field, and the owner's to ask for. The domain
half of that sentence has been struck; see below.

THE REGISTERED ADDRESS IS OMITTED for the reason A22 omitted STORE
DETAILS: "Metheues Clothings Ltd, Unit 7, Pollard Yard" is a column
nowhere, it is legal content waiting on the same review as the returns
and privacy copy, and a placeholder postal address is the one thing on
that page a customer might act on by posting something to it. Kept as
written, by contrast: the reply times and the opening hours. Nothing
measures or enforces either, but they are the owner's commitments about
the owner's own behaviour, which is what a contact page is for — the
same call 32 makes about its copy. The address itself comes from
store_settings.contact_email rather than the design's hardcoded one, so
A22 moves it.

STILL DEAD, and each for its own reason: /privacy, /terms and
/accessibility (35) are blocked on the legal review already on the
owner's list; /size-guide (23) is blocked on verified garment
measurements (§8.5), the same thing the homepage's "Open the size guide"
points past. So of the eight, five are closed and the three that are not
are owner-blocked rather than unbuilt.

THE AUDIT LOG NOW COVERS EVERYTHING THE SPEC REQUIRES, and the one gap
that was a real requirement rather than a drawn filter option has been
closed on both halves. §9.6's sentence asks for explicit confirmation AND
audit logging on four things: refund, cancellation, product archive and
negative stock adjustments. Refund and cancellation had both (A15/A16's
consequence lists and typed confirmations, 012's audit rows). PRODUCT
ARCHIVE HAD NEITHER — it was one option in a status select, saved
alongside the SEO fields, taking a T-shirt off the shop for everyone with
nothing written anywhere. A NEGATIVE STOCK ADJUSTMENT had the row (015)
and no confirmation.

Both confirmations are now real dialogs on the shared ModalDialog, with
the consequence list the Button component's description requires in place
of a destructive style, ending with the literal audit line they will
write — which is what `admin_dialog_pattern` in the ledger says every
auditable dialog does. Archiving names the four things that actually
happen (it leaves the shop, orders already placed are unaffected because
each line holds its own snapshot, nothing is deleted, and the archive date
is kept from the FIRST time since the route only sets archived_at when it
is null). The stock dialog confirms a REDUCTION rather than a mode: "Set
to 2" on a variant holding 14 removes twelve T-shirts exactly as surely as
"Remove 12" and is the easier of the two to do by accident. It shows
14 → 2 rather than making someone subtract, says when the result is Sold
out, and DISABLES itself below zero rather than letting adjust_stock
refuse — the component's rule being that a disabled control must carry
text saying what would enable it.

THREE NEW AUDIT WRITERS, none needing a migration: product status
transitions (PATCH /api/admin/products/[id]), price changes (PATCH
/api/admin/variants/[id]) and homepage publishes (PUT
/api/admin/content). `lib/admin/audit.ts` is the one place a route writes
a row; it needs the SERVICE client because 002_rls.sql:149 revokes INSERT
on audit_logs from `authenticated` deliberately, and it resolves
actor_label from `profiles` rather than taking it as an argument — the
same choice 015 made inside adjust_stock, because a label the caller
supplies can disagree with the profile it names.

THREE RULES THEY ALL FOLLOW. The row goes AFTER the write, never before:
an append-only log cannot retract an entry, so a row describing a change
that then failed is a lie nobody can correct. Nothing is logged when
nothing moved — a re-save of a published product, a publish that changes
no slot — or the four entries that matter drown in re-saves. And the
state BEFORE the write is read first, so the entry can say what it was:
the old status, the old price, which homepage slots actually differ. A21
publishes all eight slots every time by design, so without that diff the
only honest summary would be "the homepage was republished", which cannot
answer "who changed the hero heading".

Price changes are audited although NO SCREEN EDITS A PRICE — the variant
manager shows it read-only and A06 sets it at creation — because the route
is the only way one can move, which is exactly where the row belongs
rather than in whichever screen eventually draws the field.

A23 resolves the new entity types too. A `product` row read "product (no
longer in the catalogue)" for a T-shirt still on the shop, because only
orders and returns were ever looked up; products resolve to their name,
variants to their SKU, and the homepage to a fixed id with no lookup at
all.

`components/admin/dialog-styles.ts` moved up out of `orders/[id]/` with
this. A18 already reached across for it with `../../orders/[id]/`, which
is the layering mistake form-styles.ts was moved for, and these two
dialogs would have been the fifth and sixth consumers.

THE BAG ICON NEVER INDICATED ANYTHING, reported as "when i add to bag, it
doesnt indicate in the bag icon", and it was real. §8.6 lists five things
that must happen after adding a variant and the second is "Update the bag
count". Nothing did: the header's Bag was a plain `<Link>` wrapping an
icon, and the only feedback anywhere was one line of text on the product
page itself.

The machinery was already there and unused — `useCart()` has listened for
CART_EVENT and `storage` since the bag was built, so this is six lines in
the header plus a class. The count is a SUM OF QUANTITIES, matching what
the bag page's own totalQuantity calls the item count: two of one T-shirt
is two items there and must be two here.

IT IS A DELIBERATE ADDITION BEYOND THE DESIGN FILE. The Header component
set draws no badge in any of its three variants — 15:29 is a bare 44px
Icon / Bag — because the design's answer to "did that work" is the side
panel at 05G/H/I. That panel was unbuilt when the badge went in, so the
count was the spec's requirement met without the screen meant to carry
it; 05G/H/I has since been built, so the badge is now the SECOND signal
it was always going to become — the panel answers the moment, the badge
answers every moment after it. The open question narrows to one thing
for the design owner: whether the Header component should gain a count
variant, since the implementation is ahead of the file here and a
re-sync from Figma would otherwise drop it.

Two rule-8 details. The count is in the ACCESSIBLE NAME ("Bag, 3 items" /
"Bag, empty") and the badge is aria-hidden, so it is not a visual-only
signal and the number is not announced twice. The badge is `--mc-accent`
as a FILL with `--mc-accent-text` on it, never accent as type on the Paper
ground. Measured at 390/768/1440 empty, at 3 and at 99+: wordmark offset
stays 0 at every width with the badge present — the 44px imbalance the
FILL columns exist to prevent, and the exact thing that broke the last
time something was added to this row — the bag target stays 44x44, the
badge stays inside it, and nothing overflows.

CONFIRMED ON THE DEPLOYED APP by the owner on 24 October ("its working
now"), which is worth recording for a reason beyond the badge: THE CART
ITSELF HAD NEVER BEEN SEEN WORKING IN PRODUCTION. localStorage, the
CART_EVENT dispatch and useCart's listener were all verified here by
`tsc`, `next build` and a static harness, because this sandbox cannot load
the real pages. An add-to-bag that updates the header without a reload
exercises all three end to end in a real browser. The bag page's own
reads were always implied by MC-10006 reaching checkout; the live update
is the part that was only ever inferred.

THE BAG SURVIVED CHECKOUT, reported from the thank-you page: "after
payment, theres is still indication on the shopping bag that i have items
in the bag". `clearCart()` had existed in lib/bag/cart.ts since the bag was
built and NOTHING EVER CALLED IT — the second function in two days found
written, exported and unused, after useCart() and the bag count.

The badge was the visible half. The real one is that /bag still listed
everything just paid for, and Secure Checkout would have created a SECOND
order for the same T-shirts. A stale number is cosmetic; paying twice is
not, which is why this is cleared although the design file draws nothing
about it.

IT CLEARS ON THE CONFIRMATION PAGE, not before. Stripe's success_url lands
on /order/[orderNumber], so that is the first moment the browser is back
under our control after a completed payment. Clearing before the redirect
would empty the bag of everyone who reaches Stripe and changes their mind
— cancel_url comes straight back to /bag, and finding it empty is the one
thing guaranteed to lose that sale.

A LIST OF CLEARED ORDER NUMBERS GUARDS IT, capped at 20. That page is
reachable by typing a URL and order numbers are sequential by design, so a
bare clear-on-mount would empty a bag refilled since every time someone
opened an old confirmation from their history or hit back. The guard
answers "has this order had its turn", not "did it remove anything", so an
order whose first visit found an empty bag still spends a slot — otherwise
it would come back later and empty a bag that had been refilled. Corrupt
guard data falls back to "nothing cleared yet" rather than disabling
clearing for good. The trade-off left standing: opening a confirmation for
an order you never placed costs you your own bag, in your own browser,
affecting nobody else.

Seven semantics exercised against a real localStorage in Chromium — clears
after payment, a refill survives a revisit, the next order still clears, an
empty first visit still guards, corrupt data still clears, the list caps at
20 and keeps the most recent. That was the ALGORITHM verified and not the
React wiring, because this sandbox cannot load the page: the (site)
layout's footer reads homepage_sections. THE WIRING IS CONFIRMED TOO — the
owner paid an order on the deployed app on 24 October and the badge
cleared. So the effect runs, the event reaches the header, and the two
halves of §8.6's "update the bag count" now both work from a real
browser rather than a harness.

MC-10010 IS THE FIRST ORDER PAID WHILE SIGNED IN, and it went the whole
way on 24 October: payment_status `paid`, fulfilment_status `processing`,
GBP 240.00, a real profile_id, and FIVE `sale` inventory_adjustments for
its five lines. So the checkout profile_id fix, the webhook, the stock
decrement and the account link are all confirmed in production together.
MC-10009 remains `pending` with no sale adjustment — reached Stripe,
not completed, which is what pending means.

05G/H/I ADD TO BAG IS BUILT, which finishes §8.6 and was the last
unbuilt storefront screen set (75:1580 Desktop drawer pulled; 75:1660
Tablet and 75:1740 Mobile measured through get_metadata). The three
frames are the SAME content anchored three ways, and the only other
difference is the gutter: 24/24/20. Measured at 390/768/1440/1920 —
full-width bottom sheet at 390, a 480 sheet centred at 768, a 420 right
drawer at full height from 1440; the line photograph 88x110 and the
cross-sell thumbs 48x60 at every width, Close 44x44, both actions
stacked and full width, no overflow.

§8.6 lists five things and the header badge closed one ("update the bag
count"). This is the other four: confirm product, colour, size, quantity
and price; a side panel on desktop or a bottom sheet on mobile; View Bag
and Continue shopping; and never force navigation to the bag. Continue
shopping is therefore a BUTTON that closes, not a link — the ledger's
note on these frames says the panel "never navigates away", and a link
back to the page you are already on would still be a navigation.

A NATIVE <dialog> with showModal(), the same choice
components/admin/modal-dialog.tsx records: the focus trap, the inert
background, Escape and ::backdrop all come free. Anchoring it is
entirely which margins are auto, because a dialog centres itself by
default — `margin: auto auto 0 auto` is the sheet and `margin: 0 0 0
auto` with a full height is the drawer.

IT READS THE LIVE CART, not the line it was opened with, so the stepper,
the subtotal and the count are the same numbers /bag shows. Adding the
same variant twice opens the panel reading quantity 2 rather than two
panels each claiming 1. Removing the line closes the panel — a
confirmation whose subject has been deleted has nothing left to confirm,
and the frames draw no empty state for it.

`components/site/quantity-control.tsx` came out of the bag page with
this. The frames put the REAL Quantity Control (24:25) inside the panel,
and a second hand-copy of the stepper is exactly what
components/admin/status-badge.tsx was created to stop. Same move as
dialog-styles.ts and form-styles.ts before it.

THE CROSS-SELL SUBLINE IS DERIVED, not copied. The design draws "Limited
Edition · 3 sizes left" and "Regular fit · all sizes". The label comes
from summarizeProduct — the same helper the product cards and the shop
listing use, which exists so one T-shirt cannot show different
availability in two places — and the SIZE COUNT is real: distinct sizes
with stock among the active variants, which the product page has already
loaded for its related cards. FIT is dropped from the subline, because
products.fit is null on every published T-shirt today (the same gap Our
Story's fits clause reports) and a row reading "· all sizes" with a
leading separator and nothing before it is worse than one without.

The inline line of text the product page used to show is GONE. It was
always the stand-in — add-to-bag.tsx's own comment said so — and two
confirmations for one action is noise.

MIGRATION 021 IS APPLIED and closes the last audit gap that was closeable
in code: request_return() now writes a row. A23's footer had named this
since the screen was built — a return's PROGRESS was logged (014's
receive, decide and refund all write) but the customer RAISING one was
not, so the log could show a return being approved with no record of it
ever having been asked for. The frame draws the event (146:3756, tone
Info) and nothing wrote it.

`create or replace` with the signature unchanged, the same move 015 made
for adjust_stock, so 004's REVOKE survives. ADVISOR RUN STRAIGHT AFTER
per rule 3 and request_return is absent from both SECURITY DEFINER lints;
the baseline is exactly what it was (rate_limits/webhook_events with RLS
and no policy, citext in public, is_staff/is_owner on both lints,
leaked-password protection off).

TWO CHOICES WORTH KNOWING. actor_label is the customer's NAME where a
profile has one and the word "Customer" where it does not — not the
frame's "System", because a person asked for this and every other entry
names one, and not their email, because audit_logs is append-only by the
forbid_audit_mutation triggers and an address written here could never be
erased. A20 already records that erasing a customer has to null the
person out while the sales history stands; the return NUMBER in entity_id
is what connects the entry to them, through A18, and that stays erasable.
The summary carries the item count and the value, which is what the
frame's own entry shows; the customer's note is deliberately not copied
into it — it is their words, A18 already shows them on the return, and
this is the one table where copying them would make them permanent.

THE FUNCTION WAS EXERCISED, not just applied: calling it against
MC-10009 (pending, so not returnable) raised the guard it was written to
raise, and `returns` and `audit_logs` were both unchanged afterwards —
0 and 8 rows. So the replace left the guards intact and the test created
nothing. THE AUDIT INSERT ITSELF IS UNEXERCISED, deliberately: the only
way to reach it is to raise a real return against a real paid order, and
this environment's tooling gates DELETE, so a test return would be
permanent on the owner's own MC-10010. Raising one from /account or
/track-order is the test.

That leaves SIGNING IN as the only event the A23 frame draws and nothing
writes, and it is not in the spec. Worth settling with the design owner
rather than building: a row per sign-in is high volume, the storefront's
sign-ins are customers rather than staff, and a staff-readable log of
customer sign-ins is a different thing from an admin audit trail.

THE MIGRATIONS README IS REWRITTEN, which this file had flagged twice as
"stale as of 003". It opened with "Three migrations" and "These have not
been applied to your Supabase project" — both true in September, neither
true since — and its closing section listed four things as "what still
needs writing" that have all been written. It now indexes all twenty-one
with a line each, names where those four actually live (the webhook's
`req.text()`, lib/rate-limit.ts over 006, the `.strict()` schemas,
request_return's coalesce), and states what is genuinely still open at the
database level rather than what was open a year ago.

TWO THINGS THE REWRITE FOUND, both by counting against the live database
rather than reading the file.

020 WAS APPLIED AND WAS NOT IN THE MIGRATION HISTORY — `list_migrations`
returned 001-019 and then 021, because the owner ran it through the
dashboard SQL editor rather than the tooling. CLOSED on 25 October by
re-running the file through apply_migration, which was safe for the reason
this note gave: it is only REVOKE and GRANT, so a no-op against grants
already in place. `information_schema.column_privileges` was checked either
side and is identical — `authenticated` UPDATE on exactly full_name,
marketing_opt_in, marketing_opt_in_at and phone, and `anon` no UPDATE row
at all. The advisor run 020 had never had from a session was done with it;
the baseline is unchanged and `profiles` is flagged by nothing.

020 NOW SORTS LAST IN THE HISTORY, after 021, and that is correct rather
than a mistake to fix. Versions are assigned when a migration is APPLIED,
not read off the file name, so 020 carries `20261025085615` against 021's
`20261024223909`. The history records when each statement ran and 020 ran
through the tooling last. Reordering it would mean editing a history table
to make it disagree with what happened.

store_settings HAS SEVEN READ COLUMNS AND TWO UNREAD, not six and three.
That line had been carrying its own arithmetic error — it said six while
listing seven. Corrected above.

RULE 3 VERIFIED DIRECTLY rather than through the advisor, which only ever
reports the two exceptions. Nineteen SECURITY DEFINER functions exist and
`has_function_privilege` says seventeen are service_role only; the two
that are not are is_staff and is_owner, for the documented reason. That is
a stronger check than the advisor baseline and worth repeating the next
time a function is added.

EVERY QUESTION FOR THE DESIGN OWNER IS NOW IN ONE PLACE:
`docs/design-questions.md`. They had accumulated across this file in the order
they were found, which is the order nobody wants to read them in. It is in
three parts — the open decisions that change what gets built, the departures
already shipped that need confirming or reversing, and the things waiting on
content or an account rather than on a design call — and each entry states what
the design says, what the system does, what shipped and what is needed, with
node ids so a frame can be opened without searching. ADD TO THAT FILE rather
than to this one when the next disagreement turns up; this file keeps the
reasoning at the point it was found, that one is the list someone can answer.
It also carries the ledger's own `open_question_danger_button`, whose status is
still "not raised with user yet".

THE FIVE GUEST ORDERS ARE BACKFILLED, at the owner's instruction, and there
are now ZERO orders with a null profile_id. MC-10004 to MC-10008 all carried
`oluwadamilola.william@gmail.com`, and exactly one profile holds that address,
so the match was unambiguous rather than a guess. The statement was scoped
three ways and is worth keeping as the shape for any future backfill: only
rows that are NULL now, only where the order email matches a profile, and only
where EXACTLY ONE profile holds that address (`having count(*) = 1`), so a
duplicate could never silently attach one person's order to another. It is
reversible — setting profile_id back to null restores guest status — which is
why it was safe to run where the 021 test below was not.

MIGRATION 021's AUDIT INSERT IS EXERCISED AT LAST, and this file said it was
not and could only be by raising a real return. RET-4404 was raised against
MC-10010 on 25 October, one line (BLACK/XXL, £48.00) with reason `wrong_size`.
audit_logs went 8 -> 9 and EVERY DOCUMENTED CHOICE HELD: actor_label is
"Oluwadamilola Ajayi", the customer's name from their profile rather than the
frame's "System" and rather than their email; actor_id is the profile;
action is `return_requested`; and the summary reads "1 item requested for
return on order MC-10010, £48.00." — the item count and the value the frame's
own entry shows, with the customer's note deliberately NOT copied in. Nothing
else moved: MC-10010 is still paid/processing, inventory_adjustments is
unchanged at 27 and total stock at 63, because a `requested` return restocks
nothing — restock is what APPROVAL applies, which is the whole point of A18's
per-item decision.

ONE WORDING CORRECTION FROM THAT RUN. This file said "the return NUMBER in
entity_id is what connects the entry to them". It is the return's UUID —
`ddc47b1a-...`, not `RET-4404`. A23's batched lookup is what turns it into a
number, which is the design and is why that lookup exists; the claim as
written would have had A23 doing no work.

THE RETURN IS PERMANENT AND SHOWS IN THE ADMIN. RET-4404 sits in A17's queue
at `requested` and in the customer account's /account/returns, and DELETE is
gated in this environment, so removing it is a dashboard job. Its customer_note
says in plain words that it was raised from a session to exercise 021. That is
the cost the file predicted and the owner accepted.

THE ONE LIVE PHOTOGRAPH IS NOT THE PRODUCT IT IS ATTACHED TO, which is a
bigger problem than the lorem ipsum alt text this file has been carrying.
The storage object was fetched and LOOKED AT (the storage host is reachable
from this sandbox even though PostgREST is not — worth knowing, it is how any
future image check can be done here). It shows a model front and back in an
OVERSIZED CREW-NECK short-sleeve T-shirt with a large red and black scripture
graphic across the back — "IT TAKES FAITH TO BELIEVE THE PROMISES GOD HAS FOR
YOU", 2 Corinthians 5:7 — and a small matching chest print. The product it is
attached to is "STRIPED SHORT SLEEVE POLO TSHIRT". It is not striped, it is
not a polo, and it carries a print the product has no record of. The IVORY
colour assignment is the one part that matches. So the shop's only published
T-shirt is illustrated by a different garment, and that is what a customer
sees today on the listing, the product page and the homepage's featured row.
It is the owner's to fix in A05 — the system cannot know which of the two is
wrong.

THE ALT TEXT REWRITE WAS WRITTEN AND DID NOT APPLY. A real description was
composed from the photograph and the UPDATE on product_images timed out
against this environment's interactive confirmation gate, so the live row
still holds the lorem ipsum. The text is ready to paste into A05's
description field, which is the better home for it anyway — except that it
describes a photograph that should probably be replaced rather than
described.

WORTH CARRYING FORWARD ABOUT THE TOOLING, and it narrows a note this file has
repeated several times. The gate is NOT simply "DELETE and DROP". In the same
session, an UPDATE across five rows of `orders` went through without a murmur
and an UPDATE of one row of `product_images` timed out on the confirmation.
Both were plain UPDATEs through execute_sql. So the trigger is something other
than the statement type, and the honest version of the note is: any write can
hit the gate, a timeout means the write did NOT happen, and the way to tell is
to read the row back rather than to assume from the verb.

THE RESEND DOMAIN BLOCKER IS STALE AND HAS BEEN SINCE SEPTEMBER. This file
has carried "a verified sending domain for Resend" on the owner-blocked list
since the beginning, and used it as the third reason 34 Contact omits its
form, as a reason E1/E2 are blocked, and as the explanation for MC-10006's
`email_delivery_failed`. CHECKED AGAINST RESEND RATHER THAN AGAINST THIS
FILE: `oluwadamilolaajayi.com` is VERIFIED, sending enabled, eu-west-1,
created 19 July 2026 — before the September failure. EMAIL_FROM is
`Metheues Clothings <orders@oluwadamilolaajayi.com>` and its Vercel entry was
last edited about nineteen hours after the project was created, which is the
owner fixing it right after MC-10006 failed. So the September failure was a
FROM address on the wrong domain, corrected within a day, and this file never
caught up.

EIGHT TRANSACTIONAL EMAILS HAVE BEEN SENT AND ALL EIGHT ARE `delivered`.
E3 order confirmation (MC-10008, MC-10010), E4 dispatch (MC-10008, MC-10006),
E5 cancellation (MC-10004, MC-10005), E7 return refunded (RET-4404) and E8
order refund (MC-10008). So the §15 send path, the shared `lib/email/layout.ts`
chrome and five of the nine templates are PROVEN IN PRODUCTION against a real
mailbox, not just built. E7's body also names "Visa ending 4242", which is the
webhook's card write arriving in a customer-facing email — the end of the
six-screen narrowing this file tracked for weeks.

WHAT THAT CHANGES: the contact form is blocked on TWO things (no
`contact_messages` table, no admin inbox), not three, and nothing outside this
codebase. E1/E2 remain blocked, but ONLY on the Supabase Auth "send email"
hook, which is a dashboard setting — not on the domain. Any future note that
says email cannot send here is wrong until Resend says so.

ONE THING NOT PROVEN, and worth a test message before anyone relies on it:
`store_settings.contact_email` is `hello@metheues.com`, a DIFFERENT domain
from the one that sends, and it is the address 34 Contact tells customers to
write to. A verified SENDING domain says nothing about whether a mailbox
exists to RECEIVE. Nothing in this system can check that.

RET-4404 WAS APPROVED AND REFUNDED WITHIN THE HOUR, by the owner through the
admin, while this session was still writing up having raised it. E7 went out
at 09:56 naming £48.00 back to the Visa ending 4242. So decide_return and
refund_return have now run on it too, and the test return this file recorded
as "permanent at `requested`" is permanent at refunded instead. The owner also
cancelled MC-10004 and MC-10005 and dispatched MC-10006 in the same stretch,
each with its email delivered. COUNT THE ORDERS RATHER THAN QUOTING ANY LINE
IN THIS FILE — the owner works the admin while these sessions run, and several
numbers above went stale inside thirty minutes.

THE THREE LEGAL PAGES ARE DRAFTED — `docs/legal/`, with a README saying what
they are. "Blocked on legal review" was half right for months: the REVIEW is
blocked, the DRAFTING never was, and because nothing was drafted the review
could not start. Every factual claim in them was checked against the schema,
the routes and the processors rather than taken from a template — the
retention periods, the processor list and locations (Supabase eu-west-2,
Resend eu-west-1, Stripe, Vercel), the rights that are actually implemented,
and the ones that are not. Identity facts are `[OWNER: ...]` markers rather
than guesses, the same call A22 and 34 Contact already made about store
details. They are NOT wired up: once reviewed each becomes a
content-page-shell page like /delivery, and the figures that exist in
store_settings must be READ rather than typed, for the reason /delivery gives.

DRAFTING THEM FOUND TWO THINGS NOTHING HAD RECORDED.

THE RATE LIMITER STORES IP ADDRESSES. `rate_limits.key` is
`"<scope>:<ip>"` — lib/rate-limit.ts builds it from x-real-ip or
x-forwarded-for — so every sign-in, registration, password reset, order
lookup, return request and newsletter sign-up writes an IP to the database.
That is personal data under UK GDPR and had never appeared in any note here.
The saving grace is real: 006_rate_limits.sql:58 sweeps anything older than
one day, so the retention is short AND enforced rather than promised. It
belongs in the privacy policy and now is in it.

THERE IS NO UNSUBSCRIBE. `newsletter_subscribers.unsubscribed_at` is READ in
two places — A20 renders "Unsubscribed <date>" and the A20 export includes
it — and NOTHING WRITES IT. No route, no link, no token. This is the same
shape as every other finding in this file (a column read by something and
written by nothing), and it is latent rather than live only because nothing
sends marketing email yet. PECR requires a working opt-out in every marketing
message, so it has to exist before the first newsletter goes out, not after.
POST /api/newsletter has existed since the chrome was built; its opposite
does not.

ONE THING THE PRIVACY DRAFT CANNOT HONESTLY PROMISE YET, flagged in the file
itself rather than papered over: erasure. The policy describes disconnecting
a person from their orders while the sales record stands, which is what the
law and the tax rules together require. The code does not do that — deleting
a profile cascades to addresses and nulls orders.profile_id, which turns the
order into a GUEST order rather than anonymising anyone. A20 already recorded
that gap as a migration nobody has written; the draft marks it for the
reviewer rather than claiming a capability that does not exist.

A05 CAN SEARCH PIXABAY NOW, which is the first way a photograph gets into
this shop without somebody already having one. `GET /api/admin/images/pixabay`
searches, `POST` imports. THE OWNER DECIDED THE SCOPE on 26 October, asked
directly and answered "everything, unmarked": stock photographs may be used as
ordinary product images with no placeholder flag. That is recorded here as a
DECISION rather than a default, because the alternative offered was a marked
placeholder that could not silently ship, and the risk of the chosen option is
exactly that it can. A reader finding stock photography on products later
should know it was chosen, not slipped in.

THE CONCERN WAS PUT BEFORE IT WAS BUILT and is worth keeping: a stock photo of
*a* T-shirt on a listing tells a customer that is what arrives. Under the
Consumer Protection from Unfair Trading Regulations a misleading product image
is actionable, and under CRA 2015 goods-not-as-described is a refund right.
Stripe test mode is the only thing keeping that theoretical today.

THREE OF PIXABAY'S OWN RULES SHAPED THE CODE rather than ending up in a
comment nobody reads. (a) PERMANENT HOTLINKING IS FORBIDDEN — "download them
to your server first" — so an import downloads the file into `shop-images`
exactly like an upload, and the only Pixabay URLs in the app are the search
grid's thumbnails, which the terms explicitly permit "for temporarily
displaying search results". `product_images.storage_path` could not have held
a URL anyway; lib/images.ts says a row holds a path and never a URL. (b)
REQUESTS MUST BE CACHED FOR 24 HOURS, which is `revalidate: 86400` on the
fetch, so two staff searching the same word in a day cost one upstream call.
(c) 100 REQUESTS PER MINUTE PER KEY, and a 429 is surfaced rather than
swallowed — a rate limit and a search with no matches look identical in an
empty grid, which is the catalogue-query-as-empty-shop failure in a new place.

THE IMPORT IS THE OPPOSITE SHAPE FROM /sign AND THAT IS NOT A REGRESSION. The
sign route refuses to touch the bytes because the browser already holds the
file. Here nobody's browser holds it — it is on Pixabay, which sends no CORS
headers — so the bytes come through the function once. Vercel's 4.5 MB cap is
on the REQUEST BODY a function receives; this body is a small JSON object and
the image arrives by outbound fetch, which is uncapped. The cost is function
time and egress, which is right for an admin picking one photograph and would
be wrong for a bulk importer. THE UPLOAD STILL USES A SIGNED URL CREATED WITH
THE CALLER'S OWN SESSION, so 019's `is_staff()` storage policy refuses exactly
as it does for a browser upload — the route is a courier, not a privilege
escalation.

IMPORT TAKES AN ID, NEVER A URL. A client-supplied URL to fetch is the same
mistake as a client-supplied path to write: it turns an admin screen into a
request-forgery tool that can reach whatever the function can reach, cloud
metadata included. The id is resolved through Pixabay and the returned URL is
checked against an allowed-host set anyway.

THE DESCRIPTION IS NOT PREFILLED FROM `tags`, deliberately, and this is the
one design decision in the panel worth arguing about. Pixabay returns
"tshirt, fashion, model" — keywords for FINDING a picture, not a description
of one. Writing them to `alt_text` would satisfy the NOT NULL check and tell a
screen reader nothing, which is precisely how this shop ended up with lorem
ipsum live on its only photograph. The tags are shown beside the field as
context and a human writes the sentence; Import stays disabled until they do,
with text saying what would enable it.

`image-styles.ts` came out of image-manager.tsx with this, because
pixabay-search.tsx was its second consumer — the same move dialog-styles.ts
and form-styles.ts record, and the thing status-badge.tsx exists to stop.

THE KEY IS SERVER-SIDE AND THE SESSION CANNOT READ IT. The owner put
PIXABAY_API_KEY on Vercel (production, preview and development) as a SENSITIVE
variable, so the API returns an empty value for it and no session can decrypt
it — which is correct, and also means NONE OF THIS HAS BEEN RUN. It typechecks
and builds; the search, the import, the rate-limit branch and the storage
policy refusal are all unexercised. Searching for something in A05 on the
deployed app is the test, and the first thing to watch is whether Pixabay's
`largeImageURL` comes back as a content type `extensionFor()` admits.

THE PHOTOGRAPH WAS REPLACED AND THE ALT TEXT IS REAL NOW. Both findings this
file carried about the shop's only picture are closed, and the new one was
LOOKED AT rather than assumed: row `0dae3104`, path
`products/<id>/912f2a62....jpg`, 736x944. It is genuinely a striped
short-sleeve polo — broad navy and cream horizontal stripes, plain cream
collar, two-button placket, boxy cut — so the garment-type mismatch is gone.
The alt text was the product NAME repeated, which passes the NOT NULL check
and tells a screen reader nothing the page title has not already said. It is
now a real 312-character description, written from the image and verified by
reading the row back.

TWO THINGS ABOUT THAT PHOTOGRAPH STILL WANT THE OWNER'S EYE, neither of them
the system's to decide.

THE COLOURWAY MATCHES NO VARIANT ON SALE. `product_variants` offers BLACK,
BONE and IVORY (five sizes each, 21/25/21 in stock). The photograph is NAVY
and cream. Its `colour` is NULL, which in A05's design means "a fabric or
print detail — show it for every colour", so a customer choosing BLACK sees a
navy polo and so does a customer choosing BONE. A narrower version of the
mismatch recorded before, not the same severity, but the same shape: the
picture makes a claim the catalogue does not keep. Either the navy colourway
exists and is missing from the variants, or the photograph is of a different
colourway and wants assigning to the nearest real one.

THE GARMENT CARRIES A MARK THAT IS NOT METHEUES — a script chest embroidery
reading Young Leaders, a small globe motif and a line of smaller lettering.
Nothing here can tell whether this is the owner's own photography of stock
they bought or an image from elsewhere, but a product sold under one name and
pictured in another brand's garment is worth being deliberate about, on both
the misrepresentation and the rights side. The alt text names the embroidery
rather than omitting it, which is what §13 wants anyway: text inside an image
belongs in its text alternative.

WHAT PROBABLY MADE THE EARLIER WRITES HANG. Three attempts at this one update
timed out on the confirmation gate across two days; the fourth went straight
through. The statement that worked differed in exactly two ways from the ones
that did not: no `returning` clause, and no double-quote characters inside the
string literal. Which of the two mattered is untested — but it is the first
lead this project has had on a gate it has been treating as arbitrary, and the
cheap move next time a write hangs is to drop the RETURNING and strip the
fancy punctuation before concluding anything. The rule stated last time is
what caught this one: a timeout means the write did NOT happen, and the way to
tell is to read the row back.

THE UNSUBSCRIBE GAP IS CLOSED, and migration 022 is applied. This was the
last "column read by something and written by nothing" this project had on its
list: `newsletter_subscribers.unsubscribed_at` has existed since 001, is READ
by A20 and the A20 export, and nothing ever wrote it. 022 adds
`unsubscribe_token uuid not null default gen_random_uuid()` with a unique
index, so every row that already existed gets one and no address is stranded
without a way out. Rule 3 needs no advisor run here — 022 adds no SECURITY
DEFINER function — and the table was empty, so there was nothing to backfill.

A TOKEN, NOT THE EMAIL ADDRESS, for the reason rules 5 and 6 give about guest
orders: a link carrying `?email=` lets anyone unsubscribe anyone AND answers
"is this person on your list" to whoever asks. A uuid names a subscription and
proves nothing about an address somebody guessed.

AND THE LINK MUST NOT ACT ON GET, which is the part worth remembering. Mail
clients and security products fetch the links in a message before a human sees
them — Safe Links, corporate scanners, prefetchers. An unsubscribe on GET is
an unsubscribe nobody asked for, and the first you know is the list quietly
emptying. So `/unsubscribe` renders a page that says what is about to happen
and POSTs from a button; RFC 8058's One-Click header is a POST for the same
reason. `unsubscribed_at` is set only the first time (`.is('unsubscribed_at',
null)`), because it records when consent was withdrawn rather than when
somebody last clicked.

35 LEGAL IS BUILT — /privacy, /terms and /accessibility — which closes the
LAST THREE dead links in the site chrome. All eight are now live. Built on
`content_page_shell` like /delivery and /our-story, content from the
`docs/legal/` drafts.

THE DEMO IDENTITY VALUES ARE THE OWNER'S CALL, taken 26 October ("use a demo
for now"), and they are never silent. `components/site/draft-notice.tsx` holds
one `DEMO_IDENTITY` block used by all three pages — so replacing it with the
real thing is a single edit and cannot be done to two pages out of three — and
a `DraftNotice` banner that every page opens with, saying the document is not
in force and the registration details are placeholders. The values are
deliberately and visibly unreal ("00000000 (placeholder)"), because a
plausible-looking fake company number is worse than an obvious one: somebody
might believe it. REMOVING THE BANNER IS THE LAST STEP OF GOING LIVE, after
the real facts are in and a solicitor has signed the text off.

NO FIGURE IS TYPED INTO /terms. Delivery charges, the threshold and the
returns window live in store_settings and /delivery reads them; restating them
would create a second place for the number to disagree with the basket, which
is the failure /delivery's own comment exists to prevent. It links there
instead. The 14-day cancellation right is statutory and fixed, so that one is
written out.

PART A IS RATIFIED, 26 October, and the ratification is recorded in
docs/design-questions.md rather than here because that is where someone will
look. It resolved three different ways: eight entries CONFIRMED AS SHIPPED
(including the ledger's own `open_question_danger_button`, open since
September); four DECIDED NOT TO BUILD with the reason kept (no "Start
packing" — the contention needs two pickers and there is one; no sign-in
auditing — volume, not in §12, and a staff-readable log of customer sign-ins
is a different object; no scheduled-publish cron — zero collections to
publish; and A23's eight event types treated as illustrative since neither
§9.6 nor §12 contains them); and three STILL GENUINELY OPEN because they are
not ratifiable from a session — the Header count variant is a Figma change,
the breakpoint wording belongs to whoever owns the ledger, and the contact
form is a feature to commission rather than a decision to take.

NAVY IS A REAL COLOURWAY NOW, and the photograph is assigned to it. The
owner was asked which of BLACK/BONE/IVORY to assign a navy-and-cream
photograph to, and chose the honest answer instead: add the colourway the
picture actually shows. Five variants, SKUs matching the existing pattern
(`...-NAVY-<SIZE>`), £48.00 like every other variant, low_stock_threshold 5.

STOCK WAS 0 ON ALL FIVE AND IS NOW 20 EACH, set by the owner on 26 October.
It opened at 0 deliberately — inventing inventory is the same class of error
as inventing a fabric composition — and stayed that way until a real number
arrived rather than being guessed.

IT WENT THROUGH adjust_stock(), NOT AN UPDATE. A direct write to
`product_variants.stock_quantity` would have moved the number and bypassed
both the inventory_adjustments ledger and the audit row 015 added, which is
the whole reason 002_rls.sql gives staff no INSERT policy on that table.
Verified after: five variants at 20, one `manual` adjustment each recording
0 -> 20, and five matching `stock_adjusted` audit rows. actor_label is
`System` rather than a person, which is the honest label — nobody clicked
A08; a session called the function on the owner's instruction, and the note
on each row says exactly that.

READ AS 20 PER SIZE rather than 20 shared across them, which is the natural
reading of "20 across all sizes" but is worth flagging because it makes NAVY
100 units against BLACK 21, BONE 25 and IVORY 21. If 20 TOTAL was meant, it
is one more adjust_stock call per size to correct and the ledger will show
both movements, which is what the ledger is for.

IT CHANGED LESS THAN IT SOUNDS, which is worth knowing before reading a bug
into it. product-media.tsx picks `this colour's images, plus any assigned to
no colour, falling back to the whole set` (`forColour.length > 0 ? forColour :
images`). The photograph used to be NULL-coloured, so every colourway showed
it; now it is NAVY-only, so BLACK, BONE and IVORY have no image of their own,
hit the fallback, AND STILL SHOW IT. What moved is the label, not what a
customer sees. The visible difference arrives with the second photograph.

THE CATALOGUE HAS THREE MORE T-SHIRTS, all DRAFT, XS to XXXL: OVERSIZED CREW
NECK TSHIRT, LONG SLEEVE CREW NECK TSHIRT, RELAXED FIT POCKET TSHIRT. Two
colourways each (BLACK, BONE), fourteen variants apiece, £48.00 matching the
only other product, stock 0, SKUs on the existing `<SLUG-UPPER>-<COLOUR>-<SIZE>`
pattern. That takes the catalogue from 1 product and 20 variants to 4 and 62.

THE OWNER ASKED FOR THESE TO BE SOURCED BY SEARCHING THE INTERNET, and that
is worth recording precisely because only half of it is a thing a search can
do. There is no fact on the internet about what Metheues Clothings sells —
only the owner holds that. What a search WOULD turn up is other brands'
catalogues, and copying their product names, descriptions and prices into this
shop would be passing off someone else's range as ours: product names can be
trademarks, descriptions are their copy, and a listing for a garment nobody
here stocks is a sale that cannot be fulfilled. So nothing was copied from
anywhere.

WHAT WAS CREATED INSTEAD is three GENERIC GARMENT ARCHETYPES — names that
describe a cut rather than borrow a brand. "Oversized crew neck", "long sleeve
crew neck", "relaxed fit pocket" are shape descriptions in common use and
belong to nobody. The blurbs describe silhouette only, for the same reason:
"a boxy crew neck with a dropped shoulder and a wide body" is a fact about a
pattern, where anything about weight, fibre or origin would be the fabricated
regulated claim this file has refused twice already.

EVERYTHING UNVERIFIABLE IS LEFT NULL, consistent with the striped polo:
`fit`, `composition`, `fabric_weight_gsm`, `made_in`, `neck`,
`care_instructions`, `design_story`. The price is COPIED from the existing
product rather than invented, which is a starting point for the owner to
change rather than a claim; stock is 0 for the reason NAVY opened at 0.

DRAFT IS LOAD-BEARING HERE. `products.status` defaults to draft and RLS
publishes only `published`, so no customer can see these. That matters more
than usual because DELETE IS GATED in this environment: these rows cannot be
removed, only archived. Publishing is therefore the owner's deliberate act on
the ones they actually stock, and the rest stay invisible rather than
accumulating as junk on the shop.

XXXL RATHER THAN 3XL, deliberately. The spec sheet writes 3XL and the existing
product writes XXL, so one of the two conventions had to win within a single
size run. `lib/shop/size-order.ts` sorts both (3xl is aliased to xxxl), so this
is a display-consistency choice and not a functional one.

A SPEC SHEET ARRIVED AND IT IS A STANDARD ONE, not this garment's. Saved at
`docs/spec/tshirt-standard-specification.pdf` with a line-by-line §8.5 gap
analysis beside it in `docs/spec/README.md`. Its own title is "T-Shirt
Standard Specification", section 1 is headed "Regular Fit Unisex / Men's" and
it carries "Standard engineering tolerances: +/- 2.5 cm". So it is an industry
reference for a generic blank, and §8.5 opens with "must be specific to the
actual T-shirt blank or manufactured garment" and closes with "Example data
must be replaced by verified production measurements before launch".
Publishing it as screen 23 would be publishing example data, which is the one
thing that sentence forbids — the same failure this file has flagged for
months arriving through a different door.

IT MEETS FOUR OF §8.5's TEN POINTS. Chest width and body length (both units),
the explanation that the values are garment measurements, and a genuinely good
how-to-measure section worth reusing verbatim. MISSING: shoulder width, sleeve
length, the regular/relaxed/oversized explanation, model height and worn size,
and any basis for a "choose your usual size" line. Two of those are a tape
measure away; two are facts about our garment and our photography.

IT CONTAINS NONE OF THE FOUR NULL COLUMNS. No fibre content, no GSM, no
country of origin anywhere in it — which is expected, since a production
reference cannot carry them. They come from the care label or the supplier.

AND IT CONTRADICTS THE PHOTOGRAPH. The sheet specifies REGULAR FIT; the live
product photograph is an OVERSIZED, boxy polo with a dropped shoulder. Both
cannot describe one garment, so `products.fit` stays null rather than being
set from the document. That column is not cosmetic: the shop listing builds
its Fit filter from it, Our Story derives a sentence from it, and 05G/H/I's
cross-sell subline reads it, so a wrong value propagates to four places at
once.

THE GARMENT SPECIFICATION IS STILL NULL AND WAS NOT FILLED IN. The owner
asked for fit, made_in, composition and fabric_weight_gsm to be looked up on
the internet, and that was declined rather than done. Fibre composition and
country of origin are regulated claims in the UK (textile labelling; the
origin rules under consumer protection law), and a size guide drives returns.
Copying them from whatever similar garment a search turns up would be writing
another company's product facts into this shop's catalogue as if they were
measured here — the same fabrication every other page in this project refuses,
with legal consequences attached and a customer on the other end. They have to
come from the supplier's spec sheet, the garment's own care label, or a tape
measure. The same applies to §8.5: the design's size tables are placeholders
and the only honest source is measuring real stock. Offered instead: hand over
the spec sheet or label photographs and they go in immediately; measure three
garments per size and the size guide gets built.

Blocked on the owner, not on code: photography (there is somewhere to put
it now — what is missing is the pictures), verified garment measurements
(§8.5 — the size tables in the design are placeholders and must not ship), real
delivery rates, the £150 threshold, and legal REVIEW of the three pages now
drafted in `docs/legal/` (the drafting is done; the review and the
`[OWNER: ...]` identity facts are not). Three seeded values in migration
008 are marked PLACEHOLDER for the same reason.

## Conventions

- Commit messages explain *why*, and name the failure mode when fixing one. The
  history is meant to be readable as a record of decisions.
- Migrations are numbered and never edited once applied. Fix forward.
- Test destructive database work against the live project only with data you
  created, and delete it afterwards — confirm the tables are back to zero.
