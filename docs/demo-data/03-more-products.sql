-- Metheues Clothings — DEMO DATA, part 3: the rest of the range
--
-- Run on 27 October 2026 against the live project, at the owner's request:
-- "Add more products, tshirts, polo, wife beaters, tank tops, all variety of
-- tshirts and different colors". Eight products, 21 colourways, 105
-- variants. EVERY VALUE HERE IS A PLACEHOLDER, same as parts 1 and 2, and
-- `docs/real-data-needed.md` lists what replaces it.
--
-- ============================================================ NAMING
--
-- THE SLEEVELESS VEST IS NOT CALLED WHAT THE OWNER CALLED IT, deliberately.
-- "Wife beater" is the common name for a ribbed sleeveless A-shirt and
-- everybody knows which garment is meant, which is exactly why it was clear
-- in the instruction. It is not a name to put on a product page: it names
-- domestic violence, it would sit in the page title, the SEO description,
-- the order confirmation email, the pick list and the customer's bank
-- statement line, and it cannot be quietly corrected once a search engine
-- has indexed it. The garment is listed as RIBBED SLEEVELESS VEST TSHIRT,
-- which is what UK retail calls it. Easy to change if the owner wants it
-- changed -- it is one `name` and one `slug` -- but it should be a decision
-- taken on purpose rather than a transcription.
--
-- TANK TOP IS A SEPARATE PRODUCT and not a synonym for it. The vest is
-- ribbed, slim and high at the armhole; the tank is flat jersey, relaxed,
-- with a lower armhole and a wider strap. They are different garments and
-- someone buying one does not want the other.
--
-- EVERYTHING IS product_type = 'tshirt' because that enum has exactly one
-- value (checked, not assumed). The polo already in the catalogue is a
-- 'tshirt' too. §1 calls this a T-shirt-first storefront, so a polo and a
-- vest being T-shirt-typed is the schema agreeing with the spec rather than
-- a gap -- but if the shop ever needs to FILTER by garment type, that is a
-- new enum value and a migration, not a free-text column.
--
-- ============================================================ PRICES VARY,
-- AND THAT IS A CHANGE OF POSTURE WORTH STATING
--
-- Part 1 copied £48.00 onto everything rather than inventing a price. That
-- was right when there was one product to copy from, and it is wrong now:
-- a catalogue where every garment costs exactly the same never exercises a
-- price RANGE on a card, never lets a bag cross the £150 free-delivery
-- threshold on three items rather than four, and reads as obviously fake to
-- the owner looking at it. The ladder below is placeholder pricing shaped by
-- how much garment there is -- a vest under a long sleeve polo -- and every
-- figure is listed in `docs/real-data-needed.md` as the owner's to set.
--
-- ============================================================ SIZES
--
-- FIVE SIZES, NOT THE SEVEN the existing products carry. Two reasons, and
-- the second is the real one. A range opening with S to XXL is what a small
-- brand actually receives in its first delivery. And every opening stock
-- figure is a permanent `audit_logs` row (migration 015), so 105 variants is
-- already enough that A23 needs its action filter to read anything else --
-- 147 would have been that for no gain. XS and XXXL are one A06 run away
-- when they are genuinely stocked, and the existing products already cover
-- both ends for the Sold out / Low stock states.
--
-- STOCK IS NOT SET HERE. It goes through adjust_stock() in part 4, for the
-- reason part 1 gives: a direct write to stock_quantity bypasses both the
-- inventory_adjustments ledger and the audit row, which is the whole reason
-- 002_rls.sql gives staff no INSERT policy on that table. Receiving 105 SKUs
-- genuinely IS 105 ledger lines; that is the ledger working, not noise.
--
-- is_active is true and status is published, unlike part 1's drafts: the
-- point of this batch is a shop the owner can look at. The teardown returns
-- them to draft rather than deleting them, because DELETE is gated in the
-- session tooling and a draft is invisible to customers anyway.

insert into products (
  slug, name, product_type, status, description_short, design_story,
  fit, fabric_weight_gsm, composition, neck, made_in, care_instructions,
  published_at
) values
  (
    'classic-crew-neck-tshirt',
    'CLASSIC CREW NECK TSHIRT',
    'tshirt', 'published',
    'The plain short sleeve crew, cut straight through the body.',
    'The one the rest of the range is measured against. Straight through the body with a set-in sleeve, so it sits on the shoulder rather than off it, and a collar ribbed to the same gauge as the cuff so the two wear in together.',
    'regular', 180, '100% combed cotton', 'Ribbed crew neck', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
    now()
  ),
  (
    'v-neck-tshirt',
    'V NECK TSHIRT',
    'tshirt', 'published',
    'A shallow V on the classic body, for wearing open under a shirt.',
    'The same body as the classic crew with the neckline opened to a shallow V -- deep enough to show under an unbuttoned collar, shallow enough not to gape when it is worn on its own.',
    'regular', 180, '100% combed cotton', 'Ribbed shallow V neck', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
    now()
  ),
  (
    'short-sleeve-henley-tshirt',
    'SHORT SLEEVE HENLEY TSHIRT',
    'tshirt', 'published',
    'A three-button placket where the collar would be.',
    'A collarless placket with three buttons, on a slightly heavier body so the opening holds its shape instead of curling. Worn buttoned it reads as a crew; open it does not.',
    'regular', 200, '100% combed cotton', 'Collarless three-button placket', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only. Do not iron over the buttons.',
    now()
  ),
  (
    'plain-short-sleeve-polo-tshirt',
    'PLAIN SHORT SLEEVE POLO TSHIRT',
    'tshirt', 'published',
    'The polo without the stripe, on a pique body.',
    'A knitted pique body with a plain ribbed collar and a two-button placket. Pique holds a collar up where flat jersey lets it fold, which is the whole reason a polo is knitted this way.',
    'regular', 220, '100% combed cotton', 'Ribbed polo collar with a two-button placket', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
    now()
  ),
  (
    'long-sleeve-polo-tshirt',
    'LONG SLEEVE POLO TSHIRT',
    'tshirt', 'published',
    'The pique polo with a full sleeve and a ribbed cuff.',
    'The plain polo body carried down to a ribbed cuff, so it layers under a jacket without the sleeve riding up the forearm. Same collar, same placket, more garment.',
    'regular', 220, '100% combed cotton', 'Ribbed polo collar with a two-button placket', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
    now()
  ),
  (
    'ribbed-sleeveless-vest-tshirt',
    'RIBBED SLEEVELESS VEST TSHIRT',
    'tshirt', 'published',
    'A ribbed sleeveless vest, cut close with a high armhole.',
    'Narrow rib knitted the full length of the body, which is what lets it sit close without being tight -- the rib gives where a flat jersey would pull. High at the armhole and the neck, so it stays hidden under an open shirt.',
    'slim', 180, '100% combed cotton', 'Ribbed scoop neck', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Line dry to keep the rib. Warm iron on the reverse only.',
    now()
  ),
  (
    'tank-top-tshirt',
    'TANK TOP TSHIRT',
    'tshirt', 'published',
    'A relaxed jersey tank with a wide strap and a low armhole.',
    'Flat jersey rather than rib, cut relaxed through the body with a dropped armhole and a wide strap over the shoulder. A different garment from the ribbed vest and worn differently -- this one is meant to be seen.',
    'relaxed', 200, '100% combed cotton', 'Bound scoop neck', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
    now()
  ),
  (
    'striped-long-sleeve-tshirt',
    'STRIPED LONG SLEEVE TSHIRT',
    'tshirt', 'published',
    'A knitted breton stripe on a long sleeve crew.',
    'The stripe is knitted into the body rather than printed on it, so it does not crack at the shoulder or fade off-register the way a transfer does. Even stripes, carried through the sleeve so they meet at the seam.',
    'regular', 220, '100% combed cotton', 'Ribbed crew neck', 'Portugal',
    'Machine wash cold on a gentle cycle. Wash inside out with like colours. Do not bleach. Tumble dry low or line dry. Warm iron on the reverse only.',
    now()
  )
on conflict (slug) do nothing;

-- ------------------------------------------------------------- variants
-- SKUs follow the existing <SLUG-UPPER>-<COLOUR>-<SIZE> pattern, which is
-- what A06's skuFor() builds, so a variant generated later by hand matches
-- one seeded here.
insert into product_variants (product_id, colour, size, sku, price_pence, stock_quantity, low_stock_threshold, is_active)
select
  p.id,
  c.colour,
  s.size,
  upper(p.slug) || '-' || c.colour || '-' || s.size,
  c.price_pence,
  0,
  5,
  true
from products p
join (values
  ('classic-crew-neck-tshirt',       'BLACK',    3800),
  ('classic-crew-neck-tshirt',       'WHITE',    3800),
  ('classic-crew-neck-tshirt',       'SAGE',     3800),
  ('v-neck-tshirt',                  'BLACK',    3800),
  ('v-neck-tshirt',                  'WHITE',    3800),
  ('v-neck-tshirt',                  'NAVY',     3800),
  ('short-sleeve-henley-tshirt',     'BONE',     4500),
  ('short-sleeve-henley-tshirt',     'SAND',     4500),
  ('plain-short-sleeve-polo-tshirt', 'BLACK',    5200),
  ('plain-short-sleeve-polo-tshirt', 'WHITE',    5200),
  ('plain-short-sleeve-polo-tshirt', 'SAGE',     5200),
  ('long-sleeve-polo-tshirt',        'NAVY',     6200),
  ('long-sleeve-polo-tshirt',        'BONE',     6200),
  ('ribbed-sleeveless-vest-tshirt',  'BLACK',    3200),
  ('ribbed-sleeveless-vest-tshirt',  'WHITE',    3200),
  ('ribbed-sleeveless-vest-tshirt',  'CHARCOAL', 3200),
  ('tank-top-tshirt',                'BLACK',    3200),
  ('tank-top-tshirt',                'RUST',     3200),
  ('tank-top-tshirt',                'SAGE',     3200),
  ('striped-long-sleeve-tshirt',     'NAVY',     5500),
  ('striped-long-sleeve-tshirt',     'BLACK',    5500)
) as c(slug, colour, price_pence) on c.slug = p.slug
cross join (values ('S'), ('M'), ('L'), ('XL'), ('XXL')) as s(size)
on conflict (product_id, colour, size) do nothing;

-- ---------------------------------------------------------------- stock
-- One statement, 103 adjust_stock() calls, 103 inventory_adjustments rows
-- and 103 `stock_adjusted` audit rows. That is not noise: receiving 103
-- SKUs genuinely is 103 ledger lines, and A23 filters by action, so the
-- entries that matter stay findable.
--
-- TWO COLOURWAY/SIZE COMBINATIONS ARE DELIBERATELY LEFT AT ZERO so the
-- Sold out state is visible on a new product rather than only on the
-- original four. XXL opens at 3 against a low_stock_threshold of 5, which
-- is what makes Low stock show.
--
-- `and v.stock_quantity = 0` is what makes this safe to run twice: a
-- variant that has already been stocked, or has sold, is not touched.
with target as (
  select v.id, v.size
  from product_variants v
  join products p on p.id = v.product_id
  where p.slug in (
    'classic-crew-neck-tshirt','v-neck-tshirt','short-sleeve-henley-tshirt',
    'plain-short-sleeve-polo-tshirt','long-sleeve-polo-tshirt',
    'ribbed-sleeveless-vest-tshirt','tank-top-tshirt','striped-long-sleeve-tshirt'
  )
    and v.stock_quantity = 0
    and not (p.slug = 'ribbed-sleeveless-vest-tshirt' and v.colour = 'WHITE' and v.size = 'S')
    and not (p.slug = 'plain-short-sleeve-polo-tshirt' and v.colour = 'SAGE' and v.size = 'XXL')
)
select count(*) from (
  select (adjust_stock(
            t.id, 'set',
            case t.size when 'S' then 10 when 'M' then 14 when 'L' then 14 when 'XL' then 8 else 3 end,
            'Opening stock for the demo range',
            'Set when the extended demo catalogue was seeded on 27 October 2026. Placeholder quantity: no delivery has been received.',
            null)).new_stock
  from target t
) applied;

-- -------------------------------------------- design story headings (026)
-- 04A draws a 48px headline above the story body and migration 026 added the
-- column for it. These are DEMO COPY like the design stories beside them:
-- a name for the design rather than the product, because the catalogue name
-- is already the page title forty pixels up and repeating it there prints
-- the same words twice in one viewport.
--
-- They describe the garment's defining feature and claim nothing about
-- fibre, weight or origin -- the line the rest of this file holds. A04 is
-- where the owner rewrites them.
--
-- `is null` scoping means re-running this never overwrites one somebody has
-- edited.
update products set design_story_heading = v.heading, updated_at = now()
from (values
  ('striped-short-sleeve-polo-tshirt', 'The Stripe'),
  ('oversized-crew-neck-tshirt',       'Room To Move'),
  ('long-sleeve-crew-neck-tshirt',     'The Long Way'),
  ('relaxed-fit-pocket-tshirt',        'One Pocket'),
  ('classic-crew-neck-tshirt',         'The Baseline'),
  ('v-neck-tshirt',                    'Open Collar'),
  ('short-sleeve-henley-tshirt',       'Three Buttons'),
  ('plain-short-sleeve-polo-tshirt',   'Plain Pique'),
  ('long-sleeve-polo-tshirt',          'Collar And Cuff'),
  ('ribbed-sleeveless-vest-tshirt',    'Narrow Rib'),
  ('tank-top-tshirt',                  'Cut Low'),
  ('striped-long-sleeve-tshirt',       'Breton')
) as v(slug, heading)
where products.slug = v.slug and products.design_story_heading is null;

-- ------------------------------------------------- CORE gets the full range
-- Eight of the twelve products were in no collection at all, so the product
-- page's new "Part of ..." line had nothing to show on two thirds of the
-- catalogue. CORE is the base collection -- "the shapes we keep making" --
-- and every published product belongs in it by that definition.
--
-- ITS DESCRIPTION WAS ALSO STALE: it said "Four cuts", written when the
-- catalogue had four. That was wrong the moment the range grew, independently
-- of this, so the number is dropped rather than re-counted into something
-- that goes stale again.
--
-- THE OVERSIZED EDIT is left exactly as it was. Which of the new garments
-- belong in it is curation, which is A10's job and the owner's call -- the
-- tank is relaxed and the vest is slim, so neither is an obvious member.
update collections
   set description = 'The shapes we keep making. The same cotton across every cut, restocked rather than retired.'
 where slug = 'core';

insert into product_collections (product_id, collection_id, position)
select p.id, 'dd000000-0000-4000-8000-000000000001'::uuid,
       row_number() over (order by p.created_at) - 1
from products p
where p.status = 'published'
on conflict (product_id, collection_id) do nothing;
