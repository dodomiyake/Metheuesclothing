-- Metheues Clothings — DEMO DATA, part 1: the catalogue
--
-- Run on 27 October 2026 against the live project, at the owner's request:
-- pre-supplier, this exists so the app can be seen working end to end with a
-- populated shop. EVERY VALUE WRITTEN HERE IS A PLACEHOLDER and is listed in
-- `docs/real-data-needed.md` with where it surfaces and who it has to come
-- from. `99-teardown.sql` puts it back.
--
-- WHY THESE PARTICULAR VALUES, since the project has refused to invent
-- garment facts twice before and the reasoning should not look inconsistent:
--
--  * `fabric_weight_gsm` and `composition` are 240 GSM and 100% combed
--    cotton because THE HOMEPAGE ALREADY SAYS SO. A21's craft specification
--    rows ship with exactly those two defaults, so the site was already
--    making the claim and the products were silently disagreeing by being
--    null. Matching them makes the site self-consistent rather than adding a
--    second claim. They are still placeholders in both places.
--
--  * `made_in` is Portugal, which is where a great many European blanks are
--    woven, and it is deliberately NOT the United Kingdom. Our Story says
--    "printing and finishing happen in the UK", which the design's wording
--    carefully separates from where the blank was made — a garment woven
--    elsewhere and printed here is honestly both. Setting Portugal
--    demonstrates that distinction working on the page instead of collapsing
--    it, and a UK origin claim is the single most enforcement-prone thing
--    that could be typed here.
--
--  * `fit` on the polo was left null until now for a real reason recorded in
--    CLAUDE.md: its name declares no fit, the supplied spec sheet says
--    Regular and the live photograph showed an oversized cut, so the column
--    could not be made to agree with both. The demo photograph replaces that
--    photograph, so `regular` is set and the contradiction goes with it.
--
--  * The two products whose NAMES assert a fit already carry it (oversized,
--    relaxed) and are untouched here.
--
-- STOCK GOES THROUGH adjust_stock(), never a direct UPDATE — see part 2.
-- A direct write to `product_variants.stock_quantity` would move the number
-- and bypass both the inventory_adjustments ledger and the audit row 015
-- added, which is the whole reason 002_rls.sql gives staff no INSERT policy
-- on that table.

-- ----------------------------------------------------------- specification
update products set
  neck = 'Ribbed polo collar with a two-button placket',
  fit = 'regular',
  composition = '100% combed cotton',
  fabric_weight_gsm = 220,
  made_in = 'Portugal',
  care_instructions = 'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
  design_story = 'A knitted stripe on a soft pique body, cut boxy through the chest and finished with a plain collar. The stripe is woven rather than printed, so it does not crack or fade at the shoulder the way a transfer does.',
  updated_at = now()
where slug = 'striped-short-sleeve-polo-tshirt';

update products set
  neck = 'Ribbed crew neck',
  fit = 'regular',
  composition = '100% combed cotton',
  fabric_weight_gsm = 240,
  made_in = 'Portugal',
  care_instructions = 'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
  design_story = 'The long sleeve cut on the same body as the short, so it layers under a shirt without bunching at the arm. Cuffs are ribbed to the same gauge as the collar.',
  updated_at = now()
where slug = 'long-sleeve-crew-neck-tshirt';

update products set
  neck = 'Ribbed crew neck',
  composition = '100% combed cotton',
  fabric_weight_gsm = 260,
  made_in = 'Portugal',
  care_instructions = 'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
  design_story = 'Cut wide through the body with a dropped shoulder, in a heavier weight so it holds its shape rather than clinging. Sized to be worn as it is, not sized up.',
  updated_at = now()
where slug = 'oversized-crew-neck-tshirt';

update products set
  neck = 'Ribbed crew neck',
  composition = '100% combed cotton',
  fabric_weight_gsm = 240,
  made_in = 'Portugal',
  care_instructions = 'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
  design_story = 'A patch pocket set on the left chest, stitched through both layers so it keeps its edge after washing. Relaxed through the body without the dropped shoulder of the oversized cut.',
  updated_at = now()
where slug = 'relaxed-fit-pocket-tshirt';

-- ------------------------------------------------------------------ publish
-- The three archetypes were created as drafts deliberately: `products.status`
-- defaults to draft, RLS publishes only `published`, and DELETE is gated in
-- the session that made them, so draft was what kept them off the shop until
-- somebody chose. This is that choice, made for the demo and reversible by
-- setting them back.
--
-- `published_at` is what screen 19's RELEASED field reads and what the shop
-- listing's "New" label derives from, so it is set rather than left null.
update products
   set status = 'published',
       published_at = coalesce(published_at, now()),
       updated_at = now()
 where slug in (
   'long-sleeve-crew-neck-tshirt',
   'oversized-crew-neck-tshirt',
   'relaxed-fit-pocket-tshirt'
 );
