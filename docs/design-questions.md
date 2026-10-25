# Questions for the design owner

Everywhere the build and the design file disagree, the disagreement is recorded
in a comment next to the code and in `CLAUDE.md`. That file is now long enough
that the list is impossible to read as a list, which is what this document is
for. Nothing here is a bug report. Each entry is a place where the design asks
for something the system cannot do, says two things at once, or draws a control
whose meaning would mislead the person using it — and a decision was needed to
ship.

How to read an entry:

- **Design** — what the Figma frame or the ledger says.
- **System** — what the database and the code actually do.
- **Shipped** — what the built screen does today, if anything.
- **Needed** — the decision, and what it costs either way.

Node ids are given so a frame can be opened without searching. `docs/SPEC.md`
section numbers are the spec's; `docs/design-system-state.json` is the ledger.

Part A is open — these change what gets built. Part B is already shipped and
needs confirming or reversing. Part C is waiting on content or an account
setting rather than on a design decision.

---

## Part A — open decisions

### A1. "To pack" means the opposite of `packed` (A11 Orders, 128:1827)

- **Design** — the status filter and the row badge label the `packed` state "To pack".
- **System** — `fulfilment_status = 'packed'` is set by `advance_fulfilment` when
  A13's pick list is complete. It means packing is **done**.
- **Shipped** — "Packed". Five of the six enum labels match the design; this one
  is inverted.
- **Needed** — your call on the word. The risk is concrete: a picker reading "To
  pack" on a sealed parcel re-packs it. If the design's intent is a queue of work
  still to do, the honest version is a filter named "To pack" that selects
  `processing` and `not_started`, with the badge still reading "Packed" — two
  different things wearing one label today.

### A2. The ledger's id map and its decisions list disagree about E7 (165:42)

- **Design** — the id map calls 165:42 "E7 Return approved". The decisions list
  says E7 sends "when the refund has actually left (A16), not on approval (A18)".
- **Resolved by the artwork** — the frame's own canvas note says "Approval and
  refund are separate events in the admin (A18 then A16), so this email is only
  sent once the money has actually left — never on approval alone", and the body
  reads "Your refund has been sent." So the **name** describes the outcome being
  communicated, not the trigger.
- **Shipped** — E7 sends from the refund, not the approval. E7 and E8 are one
  moment told two ways: E7 when a return is behind it, E8 when it is a plain
  order refund.
- **Needed** — rename the node in the file, or leave it. On its own the id map
  reads as a contradiction, and the next person to build from it will wire E7 to
  the approval.

### A3. Nothing is sent between E6 and E7

- **Design** — as drawn. E6 confirms the return request, E7 confirms the money
  has left, and approval sends nothing.
- **System** — the same. `decide_return` writes an audit row and no email.
- **Needed** — confirmation that the silence is deliberate. The customer posts a
  parcel and hears nothing while it travels, arrives and is checked, which on a
  slow week is a fortnight. If that is not intended, the missing template is an
  approval email and it is cheap — `decide_return`'s approve arm is already a
  write, and `lib/email/layout.ts` is the shared chrome.

### A4. A14 contradicts itself about the dispatch email (A14 Add tracking)

- **Design** — the dialog header says "There is no separate send button — the
  dispatch email goes out as part of this", and the body then draws a "Send the
  dispatch email now" checkbox, which is exactly a separate send control.
- **Settled by the design system** — the Checkbox component's own description
  says a setting that cannot be switched off should be a locked row with an
  ALWAYS ON tag rather than a tickbox nobody can untick.
- **Shipped** — the email always sends; the row is locked and tagged.
- **Needed** — confirmation. The alternative is a real choice, which means
  `ship_order` taking a parameter and staff being able to dispatch a parcel
  silently.

### A5. Nothing claims an order for packing, so the queue cannot see work in progress

- **Design** — A13 draws no start button and A12 draws no "Begin packing".
- **System** — `advance_fulfilment`'s `processing` arm exists and has no caller.
  The Stripe webhook sets `processing` on payment, so every paid order is already
  there; marking packed then jumps from that straight to `packed`.
- **Consequence** — two people can pick the same parcel. The queue cannot
  distinguish "nobody has touched this" from "someone is at the shelf with it
  right now".
- **Needed** — either a claim action (a "Start packing" button on A13, which is a
  new control the file does not draw) or an explicit decision that double-picking
  is not a real risk at this volume. The function arm is written either way.

### A6. A23 draws a sign-in event and the spec does not ask for one

- **Design** — the audit-log frame's entry list includes signing in (146:3732
  onwards).
- **System** — nothing writes it. Every other event the frame draws now has a
  writer; this is the last one.
- **Needed** — your call, and it is not just a line of code. A row per sign-in is
  high volume; the storefront's sign-ins are customers rather than staff; and a
  staff-readable log of customer sign-ins is a different object from an admin
  audit trail, with its own privacy question. §12 asks for refunds,
  cancellations, fulfilment and inventory — not sign-ins.

### A7. A23's event list and its retention period come from the frame, not the spec

- **Design** — the frame's entry list names eight event types, and its footer
  promised six-year retention.
- **Spec** — §9.6 is "Returns and refunds" and its only audit sentence is that
  refund, cancellation, product archive and negative stock adjustments require
  explicit confirmation and audit logging. §12 adds refunds, cancellations,
  fulfilment and inventory changes. Neither contains the eight-event list or any
  retention period. `CLAUDE.md` attributed both to §9.6 for a while and was wrong.
- **Shipped** — the footer no longer claims a retention period, because nothing
  deletes or archives audit rows and the table is append-only by trigger.
- **Needed** — are the eight events and the six years requirements, or were they
  illustrative? Six-year retention as a *promise* needs a deletion job that does
  not exist; as a *floor* it is already met, since nothing is ever deleted.

### A8. Hidden collections — this is a policy change, not a copy change (A09)

- **Design** — A09's footer says hiding a collection takes it out of the menu
  "but its page stays reachable by its address, so links you have already shared
  keep working".
- **System** — the RLS policy is `status = 'live' or is_staff()`
  (`002_rls.sql:88`). A hidden collection returns no row to a customer, so its
  page 404s. Shared links break.
- **Shipped** — the note says what the system does.
- **Needed** — both behaviours are defensible and the choice is yours, but
  changing a security policy to match a sentence in a footer is the wrong way
  round, so it was not done quietly. Making the footer true means a migration
  adding an unlisted-but-readable status, and a decision about whether a hidden
  collection's *products* stay reachable too.

### A9. There is no menu for a hidden collection to be hidden from (A09/A10)

- **Design** — both screens refer to "the menu", and A09 has a "Hidden from
  navigation" row.
- **System** — the site header has one static "Collections" link. No navigation
  is built from the `collections` table.
- **Shipped** — the subtitle and that row are narrowed to the collections page
  and the shop, which is where visibility actually changes.
- **Needed** — should the header's nav be generated from live collections? That
  is a real feature with a real design question (how many fit, what happens at
  nine) and it is the thing A09's copy assumes exists.

### A10. Screen 19's Desktop frame drops the sort control its own Tablet and Mobile frames draw

- **Design** — 121:5606 (Desktop) has no sort control. 121:5514 and 121:5428 both
  do, and 03A Product Listing Desktop keeps one.
- **Shipped** — sort stays at every width, on the grounds that removing a control
  only where there is most room for it is more likely to be an omission than an
  intent.
- **Needed** — confirmation, or the Desktop frame updated so the file agrees with
  itself.

### A11. The bag badge exists in the build and in no frame (Header, 15:29)

- **Design** — the Header component draws a bare 44px Bag icon in all three
  Breakpoint variants. The design's answer to "did that work" is the 05G/H/I
  confirmation panel.
- **Spec** — §8.6 lists five things that must happen after adding a variant, and
  the second is "Update the bag count".
- **Shipped** — a count badge, `--mc-accent` as a fill with `--mc-accent-text` on
  it, the number in the accessible name ("Bag, 3 items") and the badge
  `aria-hidden` so it is not announced twice. Measured at 390/768/1440 with the
  wordmark offset staying 0. The panel answers the moment; the badge answers
  every moment after it.
- **Needed** — should the Header component gain a count variant? The
  implementation is ahead of the file here, so a re-sync from Figma would drop
  the badge and the spec requirement with it.

### A12. The Button set has no destructive style (ledger's own open question)

- **Ledger** — `open_question_danger_button` records this and its status is "not
  raised with user yet". `decisions_closed.danger_button` says adding one would
  mean three new variants on a file-wide component, so it should be offered
  rather than done silently.
- **Shipped** — Cancel, Refund, Archive and the stock reduction all rely on a
  consequence list plus a typed confirmation, which is the stronger guard.
- **Needed** — leave it, or add Danger × Default/Hover/Disabled. Worth noting
  that colour is never the only signal here by rule, so a red button would be an
  addition to the consequence list, not a replacement for it.

### A13. The admin breakpoint rule is about density, and three screens are already exceptions

- **Ledger** — `admin_breakpoint_decision`, taken 10 September, names the seven
  screens built at 390 and lists sixteen as `no_mobile`. The recorded reason is
  density: "dense tables and multi-section editors fight a 390px screen".
- **What the build inferred** — counting frames suggested the line was read
  versus write, which A23 (a read screen with no Mobile frame) contradicts.
- **Where it stands** — A05 is a recorded exception, lifted by you on 18 October.
  A19 and A23 render a stacking list at 390 while staying on the `no_mobile`
  list, because the rule describes what the *design* covers rather than banning a
  page from working.
- **Needed** — nothing is blocked. It would help to restate the rule in the
  ledger as "density, and no_mobile means the design file does not cover 390,
  not that the page must refuse to render there" — because the next person to
  read the list will gate A19 and A23 behind `WideOnly` and be able to cite it.

### A14. "Printing and finishing happen in the UK" versus a per-garment column (32 Our Story, 122:6087)

- **Design** — the page says printing and finishing happen in the UK, and a value
  card reads "Made in the UK". The wording carefully separates the two, which is
  honest: a blank woven elsewhere and printed here is both.
- **System** — `products.made_in` is a per-garment fact about the blank, shown on
  the product page's specification section.
- **Risk** — a customer reads Our Story and then a product's Made in row and
  takes them for one claim.
- **Shipped** — the copy is kept exactly as designed, because an origin story is
  the one page whose content is you speaking for the business, and narrowing it
  from here would be inventing a different company. One clause **is** derived:
  "three fits — regular, relaxed and oversized" reads `products.fit`, the same
  column the shop's Fit filter builds from, and drops out entirely when no
  published product has a fit set — which is today's state.
- **Needed** — your read on whether the two claims need separating more sharply
  than the design already separates them. This is the one Part A entry where the
  build deliberately did **not** narrow.

### A15. 34 Contact's form needs three things that do not exist (123:6424)

- **Design** — a reason select, an order-number field, a message box and a Send
  message button.
- **System** — there is no `contact_messages` table or anything like one; none of
  the 23 admin screens is an inbox; and Resend refuses an unverified sending
  domain, which is not a guess — it is the one thing that actually failed on
  MC-10006 and sits in `audit_logs` as `email_delivery_failed`, "The domain is
  invalid".
- **Shipped** — the form is omitted. This is the largest omission any screen in
  the project has. The page leads with the email address from
  `store_settings.contact_email`, and the reason select and order-number field
  become "what to put in it". A Send button today would show someone "thanks, we
  will be in touch" and drop what they wrote — a real failure wearing the face of
  success.
- **Needed** — building it properly is a migration with RLS, an admin inbox the
  design does not draw, and the verified domain. That is a feature to ask for,
  not a field to add.

### A16. A18 departs from its frames once and adds one control

- **Design** — the frames draw Approve as enabled while the badge still reads "On
  its way to us". The Refund panel, one step later, already applies the bar
  ("available once the parcel is marked received and checked").
- **System** — approving applies the restock, and `decide_return` refuses to
  approve a return that has not been received. Putting stock back for a parcel
  nobody has opened is how the shop sells a T-shirt that is still in a van.
- **Shipped** — Approve is disabled until received, with text saying what would
  enable it. **Mark received was added**, which no frame in the file draws,
  although `received` is a real status with a real `received_at` column and A18's
  progress list has a "Checked at the atelier" step. Without it nothing could
  ever be approved.
- **Needed** — confirmation of both, and ideally the control drawn into A18 so
  the file matches.

### A17. Scheduling a collection is half a feature and A10 says so

- **Design** — the panel shows "Scheduled 1 Oct, 09:00", which implies a system
  that publishes for you.
- **System** — `scheduled` is a real status with a real date, and the storefront
  honours it: RLS shows only `live`, so a scheduled collection is genuinely
  invisible. **Nothing flips it to live when the date arrives** — no cron, no
  scheduled function.
- **Shipped** — the panel records the date, shows it, and says plainly that
  someone has to come back and set it live.
- **Needed** — whether to build the job. Until then the date is a reminder, and
  the copy says that rather than implying otherwise.

---

## Part B — departures already shipped

Each of these is live. They are listed so you can reverse any of them; every one
narrows a claim rather than widening it, and each has a comment at its call site.

**Copy that claimed something the system does not do**

| Screen | Design said | Shipped |
|---|---|---|
| A01 Sign In | 12-hour session expiry, sign-ins audited, admin refunds logged, stock changes in the audit log | None of the four were true. Replaced with the one true claim: `audit_logs` is append-only, enforced by the `forbid_audit_mutation` triggers. Stock changes **are** audited now (migration 015), so that one became true afterwards |
| A01 Sign In | password helper says 12 | 10, matching the real `z.string().min(10)` |
| A07 Inventory | "every manual change needs a reason and is written to the audit log" | The reason is real; the log was not. Narrowed, then made true by 015 |
| Homepage | "tracked with DPD" | "tracked" — no carrier is configured anywhere, and naming one would be the shop's most public unverifiable claim |
| Homepage | "14-day returns" | "Returns" — the design's number and the seeded `store_settings` value (30) disagree, and the homepage is the wrong place to settle it |
| 12 Orders | "Estimated delivery, tracked with DPD" | The real delivery method and the real tracking number where one exists |
| E9 | "we are posting it back to you at our cost, it should arrive within a week" | The item is being sent back and we will write with the details — nothing arranges that parcel |

**Controls with nowhere to go, omitted rather than dead-ended**

Export orders (A11), Export returns (A17), Export customers (A19), Import CSV
(A03), Export CSV (A07), Print pick list (A11) — no route, no format, no decision
about columns. A20 **does** get an export, and the difference is the point: one
person's data in an obvious format under a one-month statutory deadline is a
different ask from a bulk CSV nobody has specified.

A12 omits seven of its eight actions, because A13–A16 were unbuilt when it was
made; all four now exist and are wired. "View customer" was a dead end in A12 and
A18 until A19/A20 were built, and now resolves.

**Panels omitted for a missing column**

Internal notes (A12, A18 — no notes table anywhere, and `orders.customer_note` is
the *customer's* note, so rendering it under a staff heading would invert its
meaning); phone (checkout never asks Stripe for one); delivery estimates (A12,
/delivery, 12 Orders — nothing stores or computes one); billing address (13 — the
column is written by nothing); SMS consent (A20, 18 — an "Off" row would be
exactly the consent record the card's own footer says not to create); the
collection fee (A22, /delivery — a real column nothing applies to a refund);
printable labels and drop-off QR codes (A17, A18, /delivery, E9 — `label_expires_at`
is written by nothing); registered address (A22, 34 — legal content waiting on
review, and a placeholder postal address is the one thing on a contact page a
customer might act on).

"Refunded to the Visa ending 4242" was narrowed to "the card that paid" on five
screens and two emails, because `payments.card_brand` and `.card_last4` existed
with no writer. **That is now closed** — the webhook retrieves the charge and
writes them, so the real card is named wherever one is known. Orders placed before
that keep the fallback for good.

**Form controls changed for a reason**

A14's carrier is a text input with suggestions rather than the drawn closed
select: no carrier list exists anywhere, `delivery_method` is free text, and a
managed list belongs in `store_settings`. A14's tracking link does **not**
auto-fill from carrier and number as the design's helper claims — that needs
per-carrier URL templates, and guessing them is the same failure the
tracking-number helper warns about. A16 keeps "enter an amount" and drops "choose
lines": there is no line-level refund anywhere, and tick boxes that silently
collapse to a sum would claim a precision the record does not keep. A21's hero
destination stays a select of real destinations and the route rejects anything
else, because free text would put a 404 one typo away on the busiest button in the
shop. The mobile discovery bar's sort control was rebuilt as the Button the design
draws rather than a bare `<select>`, which sized itself to its longest option and
pushed the result count off a 390px screen.

**Additions the frames do not draw**

Keyboard Move up / Move down buttons at 44px beside the "::" handle on both drag
lists (A09 collections, A10 products) — a drag-only control cannot be operated
from a keyboard at all, which would make the one thing those screens exist for
unreachable. `/account/returns`, because the account rail draws five items on
every screen and the file has 17 Return Details with no list in front of it —
**worth settling: a screen of its own, or a section of 12 Orders?** `/collections`
index, because the site header has linked there since the chrome was built. The
admin rail collapses behind a toggle below 1440 rather than inheriting the frames'
212px chips, which left a strip of dead black beside every row (212 only means
something inside a 240px sidebar). A21 gives each reassurance highlight two fields
rather than one, because the homepage draws a title and a supporting line. A21
makes the craft specification rows editable although it does not draw them —
"240 GSM" and "100% combed cotton" are the most falsifiable claims on the
homepage, and leaving them in code would mean only a developer could correct one.

**Three A01 departures, all narrowing**

The Default Form Field's border uses `--mc-border-control` (the Figma component
was rebound to match, so the two do not diverge); "Forgotten your password?"
keeps its underline, since ink-on-white text has no other affordance; and the
small print is rewritten, per the table above.

**A13's four departures**

The per-line "Rail A · shelf 3" is omitted — no warehouse column exists anywhere,
and a made-up shelf is the one invention a picker can immediately disprove.
"Medium mailer" narrows to the real item count. The design's "packed flat, not
rolled" row appears only when `orders.customer_note` is set, and quotes it
verbatim rather than paraphrasing. "Step 2 of 4" is replaced by the real
fulfilment status.

**E8 is re-headed**

It is drawn as the refund at the end of a *return* ("REFUND RET-4471",
per-garment rows, "you asked to return part of an order"), which is not what A16
does. It is headed with the order number, has no per-line rows, and says the true
reason the email arrived.

**/delivery's seven narrowings** (33, 122:6504)

Four destination rows become two — checkout ships GB and IE only, and the price is
chosen by `delivery_method` alone, so "Republic of Ireland £9.95" and "Rest of
Europe £14.95, duties collected at checkout" are a price nobody charges, a
destination nobody can select and a duty nothing collects. Then: the 14:00 cut-off
(nothing configures or measures one); transit times as estimates; the printable
label and QR code; "a booked collection is £4.95"; and "we cover the postage both
ways" on faulty items, which keeps the statutory part — a faulty item is refunded
in full, delivery included — without inventing the parcel. Every figure on the page
is read from `store_settings`, which is the only reason the page can exist: they are
the same values checkout charges and `request_return()` enforces.

**A22 omits more than any other screen**, because the design describes a settings
table this shop does not have: Store details entirely (trading name, registered
address, company number, VAT number — none are columns); the Ireland and Rest of
Europe delivery rows; the collection fee; condition rules; both tax tick boxes
(prices are VAT-inclusive throughout, which UK law requires and every total
assumes, so a switch implying otherwise would be the most expensive wrong tick on
the screen); the Stripe account id and payout schedule; and "Invite someone",
because there is no invite flow. The staff list **is** real, read from `profiles`,
and the return window will not go below 14 days in the form — the UK statutory
minimum, which the database's own `> 0` check cannot know.

**A05's gate was lifted by you on 18 October** and is recorded in the ledger
beside the rule. The frames are still Desktop and Tablet only, so 390 there is
implementation beyond the design file rather than a frame nobody built.

---

## Part C — waiting on content or an account, not on a design decision

1. **Photography.** There is somewhere to put it now: A05 uploads, the storage
   policies are applied, and every reader is wired with a fallback well. What is
   missing is the pictures.
2. **The alt text on the one live photograph is lorem ipsum.** The form requires a
   non-empty description and got one; nothing can check that a description
   describes. §13 wants a real text alternative, and this is on the shop's only
   picture.
3. **The garment specification is empty.** The one published product has `fit`,
   `made_in`, `composition` and `fabric_weight_gsm` all null. A04 is where they
   get filled in. Until then Our Story's fits clause drops out entirely and the
   product page's specification section is thin.
4. **Verified garment measurements** (§8.5). The size tables in the design are
   placeholders and must not ship. Screen 23 is unbuilt for this reason, and the
   homepage's "Open the size guide" points at the shop instead.
5. **Legal review** of the returns and privacy copy. `/privacy`, `/terms` and
   `/accessibility` (35) are the three remaining dead links in the site chrome,
   and all three are blocked on this rather than on build time.
6. **A verified Resend sending domain.** This is the one thing that has actually
   failed in production: E3 for MC-10006 was refused with "The domain is
   invalid", and the row is in `audit_logs`. It also blocks the contact form
   (A15 above) and E1/E2.
7. **E1/E2 need a Supabase Auth "send email" hook**, which is a dashboard
   setting rather than application code. Supabase sends its own default emails
   today; routing them through the Resend templates needs that hook configured.
   The same is true of the 12-hour session expiry A01's small print used to
   claim.
8. **Real delivery rates and the £150 threshold.** Migration 008 marks three
   seeded values PLACEHOLDER. The prices are now columns rather than literals
   (migration 018) so changing them is an A22 edit, not a deploy.
9. **Whether to backfill the five pre-fix guest orders.** Every order placed
   before 24 October has `profile_id` null, because the checkout route never set
   the column. The fix is live and confirmed (MC-10009 and MC-10010 both carry
   one), but matching the older five by email is a judgement call about someone
   else's order history, so it was not done quietly.
10. **Re-run `020_profile_column_grants.sql` through the migration tooling.** It
    is applied — verified against `information_schema.column_privileges` — but it
    was run through the dashboard SQL editor, so `list_migrations` returns
    001–019 and then 021. Re-running is a harmless no-op (only REVOKE and GRANT)
    and would close the hole in the history.
