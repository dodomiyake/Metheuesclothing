# Demo data, and the end-to-end walkthrough

This folder exists because the shop is pre-supplier. It holds what was seeded,
why, and how to take it out again — plus a click-by-click script for walking
the whole process, from a customer buying a T-shirt to receiving it, sending it
back and being refunded.

`docs/real-data-needed.md` is the companion: everything a placeholder is
standing in for.

## What is in here

| File | What it does |
|---|---|
| `01-catalogue.sql` | Fills the garment specification and publishes the three draft products |
| `02-collections.sql` | Creates the two demo collections and their membership |
| `03-more-products.sql` | The other eight garments — polos, a henley, a ribbed vest, a tank — with their colourways and opening stock |
| `99-teardown.sql` | Puts it all back |

Stock went in through `adjust_stock()` rather than SQL in a file, because a
direct write to `product_variants.stock_quantity` bypasses the
`inventory_adjustments` ledger and the audit row migration 015 added — which is
the whole reason `002_rls.sql` gives staff no INSERT policy on that table. The
exact call is in `99-teardown.sql`'s notes.

Photographs are **not** seeded from SQL. They are nine generated images bundled
in `public/demo/`, and `/admin/demo` uploads them through the signed-URL path
with your own staff session, so migration 019's `is_staff()` storage policy
still applies. A script with a service key would have routed around the lock.

## What the demo data gives you

- **12 published products**, 167 variants — crew necks, a V neck, a henley,
  three polos, a ribbed sleeveless vest, a tank top and two striped pieces
- **9 colours** across the range (BLACK, WHITE, BONE, IVORY, NAVY, CHARCOAL,
  SAGE, SAND, RUST), so the Colour filter has something to filter
- **Prices from £32.00 to £62.00**, which is also what lets a bag cross the
  £150 free-delivery threshold on three items rather than four
- **Deliberate stock variety** so the states are all visible at once: most
  sizes 10–14 in stock, XXL and XXXL at 3 (**Low stock**), a few at 0
  (**Sold out**)
- **2 live collections** — CORE and THE OVERSIZED EDIT, so the shop's
  Collection filter has something real to do
- **22 photographs**: 20 model shots and 2 collection heroes

### A note on the people in them

The models do not exist. The photographs are generated, and so are the people
wearing them — which is worth being deliberate about rather than letting it
pass unremarked, because a customer looking at the shop has no way to tell.
Nothing in them carries a brand mark; all twenty were opened and looked at
before their descriptions were written, which is how the catalogue's one
earlier photograph was caught showing another label's embroidery.

---

# The end-to-end walkthrough

Takes about fifteen minutes. **Stripe is in test mode throughout** — no real
money moves.

## Before you start

1. Open `/admin/demo` and press **Add the demo photographs**. It reports what
   it added, skipped and failed. It skips any product that already has
   photography, so it is safe to press twice.
   If four products still show the original **flat-lay** shots (no model in
   them), the second button on that page replaces exactly those with model
   photography. It finds them by their exact description, so anything you
   have uploaded or re-described is untouchable by it.
2. Have two browser profiles, or one normal and one private window: you will be
   a customer in one and staff in the other. The admin and the storefront share
   a sign-in, so one window cannot be both without a lot of signing in and out.

## Part 1 — Buying

| Step | Where | What to watch |
|---|---|---|
| 1 | `/` | The homepage featured row fills with the four published products. The announcement bar's free-delivery figure is **derived** from `store_settings`, so it cannot disagree with the basket |
| 2 | `/shop` | Filters down the left at 1440px and behind a sheet below it. Try the **Fit** and **Collection** filters — both read real columns. Note the **Low stock** and **Sold out** labels |
| 3 | `/shop/oversized-crew-neck-tshirt` | Change colour between BLACK and BONE: **the gallery swaps**, because each photograph is assigned to a colourway. XS reads sold out. The specification section pulls delivery and returns from `store_settings` live |
| 3b | `/shop/ribbed-sleeveless-vest-tshirt` and `/shop/tank-top-tshirt` | Two garments people often treat as one. The vest is ribbed, slim and high at the armhole; the tank is flat jersey, relaxed and cut low. Different products, different photographs |
| 4 | Add to Bag | A panel opens — a bottom sheet on a phone, a right drawer at 1440. **The bag count in the header updates.** Press Continue shopping: it closes rather than navigating |
| 5 | `/bag` | Change a quantity, see the total move. Enter an email |
| 6 | Secure checkout | Stripe's hosted page. Card **4242 4242 4242 4242**, any future expiry, any CVC, any postcode |
| 7 | `/order/MC-100xx` | The confirmation. **The bag empties here, not before** — a customer who reaches Stripe and changes their mind comes back to a full bag |

**What happened behind that:** the webhook marked the order paid, moved it to
`processing`, wrote the delivery-address snapshot, recorded the card brand and
last four digits, decremented stock exactly once per line, and sent E3. Check
`/admin/audit` — stock adjustments are logged.

> Sign in before step 6 if you want the order attached to an account. Orders
> placed signed-out are genuine guest orders and will not appear under
> `/account/orders`.

## Part 2 — Fulfilling it

Switch to the staff window.

| Step | Where | What to watch |
|---|---|---|
| 8 | `/admin` | Orders today, paid revenue net of refunds, the awaiting-fulfilment count. The **demo data notice** sits at the top |
| 9 | `/admin/orders` | The new order at `processing`. Table above 768px, card list below |
| 10 | `/admin/orders/<id>` | A12. The timeline, the real card on the Payment panel, the audit history |
| 11 | **Pack this order** | A13. Tick every pick line — **Mark packed stays disabled until you do**, which is what the design's own helper text promises. If the customer left a note it is quoted verbatim |
| 12 | Back on A12, **Tracking** | Add a carrier and a tracking number. There is no separate send button: dispatch and the E4 email are one act. The carrier is free text because no carrier list exists yet |
| 13 | **Mark delivered** | Appears once the parcel is out. Leave the date blank for today, or put in the real arrival date. **The returns window runs from this date** |

Step 13 is new. Until now nothing in the system could mark an order delivered —
`advance_fulfilment` refuses anything but the packing steps and `ship_order`
stops at shipped, so the process ended at "on its way" and the returns clock
started when the parcel *left*.

## Part 3 — The customer sees it

Back to the customer window.

| Step | Where | What to watch |
|---|---|---|
| 14 | `/account/orders` | The order, its real delivery method and tracking number |
| 15 | `/account/orders/MC-100xx` | A five-step progress timeline derived from real columns. Delivered now has a real timestamp |
| 16 | `/track-order` | The same order found by **order number plus email together**. Try a wrong email: the failure is deliberately identical to "no such order", so the endpoint cannot be used to discover order numbers |

## Part 4 — Returning and refunding

| Step | Where | What to watch |
|---|---|---|
| 17 | `/account/orders/MC-100xx` | **Start a return** — only offered when one is genuinely possible, gated on the real delivered date and `return_window_days` |
| 18 | Pick a line, give a reason | `request_return()` writes the return **and** an audit row naming the customer by name, not by email address |
| 19 | staff → `/admin/returns` | A17. The new return at `requested` |
| 20 | `/admin/returns/<id>` | A18. **Approve is refused while the parcel is still on its way** — approving applies the restock, and putting stock back for a parcel nobody has opened is how you sell a T-shirt that is still in a van |
| 21 | **Mark received** | Then approve, choosing per item whether it goes back into stock |
| 22 | **Refund** | Type the amount to confirm. **Stripe goes first, then the database** — an unrecorded refund is recoverable, a refund recorded but never sent is not. E7 goes out naming the real card |
| 23 | `/admin/audit` | The whole chain: requested, received, decided, refunded, with who did each |

## Also worth trying

- **Cancel an order** (A15) instead of fulfilling it — refunds and restocks in
  one act
- **Reduce stock** in A08 to zero and watch the product read Sold out
- **Maintenance mode** in A22 — checkout refuses with a plain message while the
  shop stays browsable
- **Erase a customer** in A20, as an owner. It anonymises rather than deletes,
  because the audit log holds a permanent reference to anyone who has raised a
  return. ⚠️ Irreversible, even in test mode
- `/admin/audit` after all of it

## What will not work, and why

| Thing | Why |
|---|---|
| A delivery confirmation email | E1–E9 has no such template. Delivery can be marked; nothing tells the customer |
| Verification / password-reset emails in our styling | Supabase Auth sends its own until a dashboard hook is configured |
| The contact form | Omitted — no table, no inbox |
| Size guide | Blocked on real measurements |
| Exports other than a single customer's data | No route, no format |

---

# Teardown

Run `99-teardown.sql` (it returns the eight extended products to draft and
removes both batches of demo photographs), then delete `public/demo/`,
`app/admin/(protected)/demo/` and `app/api/admin/demo/`, and remove the notice
block from the dashboard.

The dashboard notice counts `products.made_in = 'Portugal'` from the database,
so it disappears on its own as soon as the real specification replaces the
placeholder — it does not depend on anyone remembering to switch it off.

**Three things the teardown deliberately does not remove:**

- **Audit rows.** `audit_logs` is append-only, enforced by the
  `forbid_audit_mutation` triggers. Rows naming demo stock adjustments stay,
  and that they cannot be deleted is the guarantee working.
- **Inventory adjustments.** Same reasoning: the ledger is the record of what
  happened, and editing it to tidy up would defeat it.
- **Any order you placed during the walkthrough.** Those are real rows in the
  sales history, test-mode or not. Cancel them if you want them closed.
