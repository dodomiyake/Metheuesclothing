# Real information still needed

This shop currently runs on demo data. It was populated deliberately, before
any supplier is in place, so the app could be seen working end to end — browse,
buy, pack, dispatch, deliver, return, refund. **Everything in this document is a
placeholder, a gap, or an account that is not connected yet.**

Nothing here is a code task. Each item needs a fact, a document, a decision or
an account that only the business can supply. Where a thing *is* a code task
it says so and points at what would have to be built.

Two things make the placeholders safe for now, and both stop being true at
launch:

- **Stripe is in test mode.** No real card can be charged, so no customer can
  rely on a placeholder claim.
- **The admin dashboard carries a notice** counting the placeholder products
  from the database, linked to `/admin/demo`. It removes itself when the data
  does, rather than depending on anyone remembering.

Severity is marked:

- 🔴 **Legal or money.** Wrong or missing information here is a regulatory or
  financial problem, not a cosmetic one.
- 🟠 **Customer-facing.** A customer reads it and may act on it.
- 🟡 **Internal.** Affects staff or reporting, not the customer directly.

---

## 1. The garment specification 🔴

Every published product currently carries the **same** fabric weight,
composition and country of origin, which is the giveaway that none of it was
measured. `/admin/demo` counts them.

| Field | Column | Demo value | Where it shows |
|---|---|---|---|
| Composition | `products.composition` | `100% combed cotton` | Product page specification; the homepage craft rows already claimed this independently |
| Fabric weight | `products.fabric_weight_gsm` | 220–260 | Product page specification; homepage craft rows |
| Country of origin | `products.made_in` | `Portugal` | Product page; collection page MADE field (only when every product agrees) |
| Fit | `products.fit` | regular / oversized / relaxed | Shop listing **Fit filter**, Our Story's derived sentence, the add-to-bag panel's cross-sell line |
| Neck | `products.neck` | Ribbed crew / polo collar | Product page specification |
| Care | `products.care_instructions` | A generic wash instruction | Product page specification |
| Design story | `products.design_story` | Written from the shape alone | Product page |

**Why these are red.** UK textile labelling law requires accurate fibre
composition, and origin claims sit under consumer protection law. A customer
who buys on the strength of "100% combed cotton" and receives a polycotton
blend has a claim, and so does a trading standards officer.

**Where they come from:** the supplier's own specification sheet, or the care
label sewn into the garment. Not from a search — a similar garment's figures
are another company's product facts.

**`fit` is the one with the widest blast radius.** It is not cosmetic: the shop
listing builds its filter straight out of that column, Our Story derives a
sentence from it, and the add-to-bag cross-sell reads it. One wrong value
propagates to four places.

**Not demo, but still empty and read by nothing:** `packed_weight_g`,
`hs_code`, `country_of_origin`. They exist for delivery and customs and no
screen reads them yet. Leave them until something needs them.

---

## 2. Photography 🟠

Every photograph on the shop was **machine-generated** for the demo. They show
the correct garment type and carry no brand marks, and they are not pictures of
stock anybody owns.

| What | Where |
|---|---|
| Product photographs | 7 images across 4 products, 2 colourways each where applicable |
| Collection heroes | CORE and THE OVERSIZED EDIT |
| Homepage hero | Not set — the homepage shows its empty well |
| Our Story image | Not settable; §9.7 limits the content system to seven homepage slots |

**Replacing them:** upload in A05 (Product images). It works on a phone, which
is where the photographs are. A05 only ever *adds*, so delete the demo image
after the real one is up, or reorder it to the front — the first image is what
every listing card shows.

**The alt text matters and is already written.** `product_images.alt_text` is
NOT NULL with a non-empty check because §13 requires a text alternative. Each
demo image carries a real description written from the picture. A real
photograph needs a real description too — this shop has already shipped lorem
ipsum and a repeated product name into that column.

**One decision attached:** stock photography was approved ("everything,
unmarked") and then found unable to furnish this catalogue — nothing oversized
and nothing with a chest pocket exists in either library. Generated images
replaced that approach. If real photography is slow, the Pexels and Pixabay
search in A05 still works for editorial surfaces like the homepage hero.

---

## 3. The size guide 🔴

**Screen 23 is unbuilt and must stay unbuilt until real measurements exist.**
§8.5 is explicit: the guide "must be specific to the actual T-shirt blank or
manufactured garment" and "example data must be replaced by verified production
measurements before launch".

A standard specification sheet was supplied (`docs/spec/`) and is an industry
reference for a generic regular-fit blank, not a measurement of anything this
shop sells. It meets 4 of §8.5's 10 points.

**What closes it,** with a tape measure and one garment per stocked size:

1. Chest width, flat across, 1 inch below the armpit fold
2. Body length, highest shoulder seam to bottom hem
3. Shoulder width, seam to seam across the back
4. Sleeve length, shoulder seam to cuff

Plus, once: which fit each product actually is, and from the shoot, the model's
height and the size they wore.

Until then the homepage's "Open the size guide" points at the shop, and a
customer guessing their size is a return you pay for.

---

## 4. Legal identity and documents 🔴

### The identity block

`components/site/draft-notice.tsx` holds one `DEMO_IDENTITY` block used by
`/privacy`, `/terms` and `/accessibility`. The values are **deliberately and
visibly unreal** — `00000000 (placeholder)` — because a plausible-looking fake
company number is worse than an obvious one.

| Needed | Used on |
|---|---|
| Registered company name | Privacy, Terms |
| Company number | Privacy, Terms |
| VAT number | Terms |
| Registered address | Privacy, Terms; also A22's omitted Store Details and 34 Contact's omitted postal address |
| Governing jurisdiction | Terms |

### The documents themselves

The three legal pages are **drafted and not reviewed**. Every factual claim in
them was checked against this codebase — the processors and their regions, the
retention periods, the rights actually implemented — but no solicitor has seen
them. Each page opens with a `DraftNotice` banner saying so.

**Removing that banner is the last step of going live**, after the real
identity facts are in and the text is signed off. Two points were flagged for
the reviewer in `docs/legal/privacy.md`: the retained audit-log entries that
name a person, and the deferral of erasure while an order is still in flight.

### Terms deliberately quote no figures

Delivery charges, the free-delivery threshold and the returns window live in
`store_settings` and `/delivery` reads them. Restating them in Terms would
create a second place for the number to disagree with the basket.

---

## 5. Store settings 🔴

Owner-only (A22). These decide what a customer is charged.

| Setting | Column | Current | Note |
|---|---|---|---|
| Tracked 48 delivery | `delivery_tracked_48_pence` | £3.95 | Seeded placeholder. Needs a real carrier quote |
| Next day delivery | `delivery_next_day_pence` | £6.95 | Same |
| Free delivery threshold | `free_delivery_threshold_pence` | £150 | Seeded placeholder. The announcement bar derives its figure from this, so the bar and the basket cannot disagree |
| Returns window | `return_window_days` | 30 days | Enforced by `request_return()`. Will not go below 14 in the form — the UK statutory minimum |
| VAT rate | `vat_rate_basis_points` | — | Confirm against registration status. Prices are VAT-inclusive throughout, which is what UK law requires |
| Contact email | `contact_email` | `hello@metheues.com` | **Unverified — see §7** |

Three values in migration `008` are marked PLACEHOLDER for exactly this reason.

**Two columns are written and read by nothing:** `collection_fee_pence`
(nothing applies it to a refund) and `from_email` (sending uses the
`EMAIL_FROM` environment variable, because Resend will only send from a
verified domain). Both need a decision — apply them, or drop them.

---

## 6. Delivery and carrier 🟠

**No carrier is configured anywhere.** This is why the homepage says "tracked"
rather than naming DPD, why A14's carrier field is free text with suggestions
rather than a managed list, and why `/delivery` names a service and promises no
date.

Needed:

- Which carrier(s), and the account
- Real rates, which become the two `store_settings` prices above
- Whether a tracking-URL template exists per carrier, so A14 can build the link
  instead of asking someone to paste it
- Whether delivery should ever be marked automatically, which means a carrier
  webhook

**Destinations are GB and IE only** and the code is built around that. A
per-country rate table is a feature, not a column — `/delivery` currently drops
the design's Ireland and Rest-of-Europe rows because nothing can charge them.

**Nothing issues a return label.** `returns.label_expires_at` exists and is
written by nothing. A17, A18 and E9 all narrow their wording because of it.

---

## 7. Accounts and connections 🔴

| Thing | State | What is needed |
|---|---|---|
| **Stripe** | Test mode. Every payment id begins `cs_test_` | Live keys, and the first live transaction — which is what exercises a real card network, settlement and Stripe's fee |
| **Resend sending domain** | ✅ Verified (`oluwadamilolaajayi.com`), 8 transactional emails delivered | Nothing |
| **Resend receiving mailbox** | ❓ **Unproven.** `store_settings.contact_email` is `hello@metheues.com`, a different domain from the one that sends | Send a test message to it. A verified *sending* domain says nothing about whether a mailbox exists to *receive*, and 34 Contact tells customers to write there |
| **E1 / E2 emails** | Supabase Auth sends its own defaults | A Supabase Auth "send email" hook, a dashboard setting, to route verification and password reset through the Resend templates that already exist |
| **Leaked password protection** | Off | A Supabase Auth dashboard toggle. Checks passwords against HaveIBeenPwned |
| **Pexels / Pixabay** | Pixabay key set; Pexels key not | Only needed if stock photography is still wanted |

---

## 8. Content 🟠

| Where | State |
|---|---|
| **Homepage** | All eight slots carry owner-set content. Editable in A21 |
| **Our Story** | The design's copy, kept as written — it is the owner speaking for the business, so rewriting it would invent a different company. **Review it and make it true** |
| **Homepage craft rows** | "240 GSM", "100% combed cotton" — the most falsifiable claims on the site, editable in A21. Must match §1 above |
| **Collections** | Two, both demo. Real ones are created in A09 |
| **Product names and blurbs** | Generic shape descriptions, chosen because no brand's catalogue could be copied. The owner confirmed the range genuinely is "all kinds of T-shirt", so these describe the business rather than standing in for it |

---

## 9. Staff and access 🟡

- There is **no invite flow**, deliberately. A new staff member is a `profiles`
  row whose `role` is changed by hand.
- `admin@metheues.test` is a dedicated owner account on an RFC 2606 `.test`
  address, so password reset can never reach it. Correct for a test account;
  delete it before launch (a dashboard job — `DELETE` is gated in the tooling
  that created it).
- **Session expiry** is a Supabase Auth dashboard setting. A01's small print
  was rewritten because the design claimed a 12-hour expiry that does not
  exist.

---

## 10. Things the design draws that nothing backs 🟡

Listed so they are not mistaken for bugs. Each is omitted rather than faked,
and each would be a feature to commission.

| Drawn | Why it is not built |
|---|---|
| Contact form (34) | No `contact_messages` table and no admin inbox. A "thanks, we will be in touch" that drops the message is a failure wearing the face of success |
| Export orders / returns / customers / CSV | No route, no format, no decision about columns. A20's single-customer export **is** built, because it has an obvious format and a statutory deadline |
| Internal notes on orders and returns | No notes table |
| Billing address on the customer's own order page | The column is written now, from the charge. Shown in the admin only — Stripe collects it only where the card network asks, so it is absent on many orders, and a row present for some customers and missing for most reads as a fault |
| Per-transition fulfilment timestamps | `fulfilment_status` is one current value with no history, so A12's timeline can only show real times for placed, shipped and delivered |
| Delivery confirmation email | E1–E9 has no such template. Delivery can now be marked; nothing tells the customer |
| Scheduled collection publishing | `scheduled` is honoured by RLS but nothing flips it to live. Needs a cron |
| SMS delivery updates | No consent column and nothing sends a text |
| Erase this profile → delete | Erasure anonymises instead, because the audit log holds a permanent reference. This is correct and documented, not a shortfall |

---

## The short version

If you can only do a few things before taking real money:

1. **Garment specification from the supplier or the care label** (§1) — the
   only red item a customer reads on every product page.
2. **Real photography** (§2) — or accept generated images knowingly, in
   writing.
3. **Legal identity facts and a solicitor's review** (§4).
4. **Real delivery rates and the free-delivery threshold** (§5, §6).
5. **Stripe live mode** (§7) — and test the contact mailbox before anyone
   writes to it.
6. **Size guide measurements** (§3) — the cheapest way to cut returns.

Then run the teardown in `docs/demo-data/` and check the dashboard notice has
gone.

---

## Database state

Every migration through 024 is applied and recorded in the migration history.
Rule 3 was verified directly rather than through the advisor: 21 `SECURITY
DEFINER` functions exist, 19 are service-role only, and the 2 that are not
(`is_staff`, `is_owner`) are deliberate and documented. Nothing here is
waiting on a database change.
