-- Metheues Clothings — DEMO DATA teardown
--
-- Puts the catalogue back to what it was before 27 October 2026. Run it in
-- the Supabase dashboard SQL editor; the session tooling that seeded this
-- gates DELETE behind a confirmation that never arrives, so the deletes
-- below have to be run by a person.
--
-- READ THE ROW BACK AFTERWARDS. The verification query at the bottom is
-- there because a timed-out or refused write is indistinguishable from a
-- successful one unless you look.
--
-- ============================================ WHAT THIS DOES NOT UNDO, AND
-- WHY THAT IS CORRECT
--
--  * AUDIT ROWS. `audit_logs` is append-only, enforced by the
--    forbid_audit_mutation triggers. The 36 `stock_adjusted` rows from the
--    demo stock, and anything the walkthrough produced, stay. Dropping the
--    triggers to tidy them away would defeat the one property that log
--    exists to have -- the same call this project already made about the
--    four ZZ-TEST rows from the 012 fixture.
--
--  * INVENTORY ADJUSTMENTS. The ledger is the record of what actually
--    happened to stock. Editing it to make the history tidier is the exact
--    thing `002_rls.sql` denies staff an INSERT policy to prevent.
--
--  * ORDERS PLACED DURING THE WALKTHROUGH. Those are real rows in the sales
--    history whether or not Stripe was in test mode. Cancel them through
--    A15 if you want them closed; do not delete them here.
--
--  * THE THREE PRODUCTS THEMSELVES. They are returned to `draft`, not
--    removed. RLS publishes only `published`, so a draft is invisible to
--    customers, and keeping them means the SKUs, the variants and their
--    ledger history survive for whenever real information arrives. If you
--    genuinely want them gone, archive them through A04 so the archive is
--    audited.

-- ------------------------------------------- 0. the extended demo range
-- The eight products added on 27 October (part 3) are returned to draft
-- rather than deleted, for the reason part 3 gives: DELETE is gated in the
-- session tooling, and a draft is invisible to customers anyway. Their
-- variants, SKUs and ledger history survive for whenever real information
-- arrives.
--
-- Stock is NOT zeroed here, the same call part 5 makes about the original
-- three: if the walkthrough sold any of it, zeroing silently rewrites what
-- the ledger says was sold. The adjust_stock() call to run if you do want
-- it back at zero is in part 5's comment; point it at these slugs.
update products
   set status = 'draft',
       published_at = null,
       updated_at = now()
 where slug in (
   'classic-crew-neck-tshirt',
   'v-neck-tshirt',
   'short-sleeve-henley-tshirt',
   'plain-short-sleeve-polo-tshirt',
   'long-sleeve-polo-tshirt',
   'ribbed-sleeveless-vest-tshirt',
   'tank-top-tshirt',
   'striped-long-sleeve-tshirt'
 );

-- ------------------------------------------------- 1. product photographs
-- The storage OBJECTS are not removed by this -- deleting a row leaves the
-- file in the bucket, which is the safe direction (an orphaned file costs
-- storage; a row pointing at a deleted file is a broken image on the shop).
-- Clear the files in A05 or the Storage browser afterwards if you care.
--
-- Matched on the alt text written by the demo seed, which is the only thing
-- that distinguishes these rows from a real upload. If you have edited the
-- descriptions, match on `created_at` instead and check the list first.
--
-- TWO BATCHES. The first seven are the FLAT-LAY photographs from the
-- original seed; /admin/demo's "Replace the flat-lays" button may already
-- have removed them, in which case this deletes nothing, which is correct.
-- The model photographs that replaced them, and the sixteen for the
-- extended range, all open with "A man stands" or "A woman stands" against
-- the same studio wall, so the second statement catches every one of them
-- without naming twenty literals.
delete from product_images
where alt_text in (
  'A short sleeve polo shirt laid flat on a pale grey background, in even horizontal black and cream stripes, with a plain cream ribbed collar, matching cream cuffs and a two-button placket.',
  'A black oversized cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck, dropped shoulder seams, short wide sleeves and a boxy body.',
  'An off-white oversized cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck, dropped shoulder seams and a wide boxy body, the cotton showing a soft natural slub.',
  'A black long sleeve cotton T-shirt laid flat on a pale grey background with both sleeves extended, showing a ribbed crew neck and ribbed cuffs at each wrist.',
  'An off-white long sleeve cotton T-shirt laid flat on a pale grey background with both sleeves extended, showing a ribbed crew neck and ribbed cuffs at each wrist.',
  'A black short sleeve cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck and a single plain patch pocket stitched on the left chest.',
  'An off-white short sleeve cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck and a single plain patch pocket stitched on the left chest.'
);

-- The model photographs. Every one of them was written from the image and
-- every one opens this way; a real photograph described by a person will
-- not, so this cannot catch one by accident. CHECK THE LIST FIRST with the
-- same predicate as a SELECT if you have added your own.
delete from product_images
 where alt_text like 'A man stands facing the camera against a plain warm-grey studio wall%'
    or alt_text like 'A woman stands facing the camera against a plain warm-grey studio wall%';

-- ------------------------------------------------------- 2. collections
-- Fixed uuids, so this removes exactly the two rows the seed created and
-- nothing anybody has made since. Membership cascades from the collection.
delete from product_collections
 where collection_id in (
   'dd000000-0000-4000-8000-000000000001',
   'dd000000-0000-4000-8000-000000000002'
 );

delete from collections
 where id in (
   'dd000000-0000-4000-8000-000000000001',
   'dd000000-0000-4000-8000-000000000002'
 );

-- ----------------------------------------- 3. the garment specification
-- Back to null, which is where every one of these started and where they
-- belong until a supplier sheet or a care label says otherwise.
--
-- `fit` is handled separately below: two of the three products assert their
-- fit in their own NAME, so null would put the row back to disagreeing with
-- itself. Those keep it.
update products
   set composition = null,
       fabric_weight_gsm = null,
       made_in = null,
       neck = null,
       care_instructions = null,
       design_story = null,
       updated_at = now()
 where slug in (
   'striped-short-sleeve-polo-tshirt',
   'long-sleeve-crew-neck-tshirt',
   'oversized-crew-neck-tshirt',
   'relaxed-fit-pocket-tshirt'
 );

-- The polo's fit was null before the demo, deliberately: its name declares
-- no fit, its supplied spec sheet says Regular and the photograph it had at
-- the time showed an oversized cut. Back to null.
update products set fit = null
 where slug in ('striped-short-sleeve-polo-tshirt', 'long-sleeve-crew-neck-tshirt');

-- ------------------------------------------------------- 4. unpublish
-- The polo was published long before any of this and stays published.
update products
   set status = 'draft',
       published_at = null,
       updated_at = now()
 where slug in (
   'long-sleeve-crew-neck-tshirt',
   'oversized-crew-neck-tshirt',
   'relaxed-fit-pocket-tshirt'
 );

-- ------------------------------------------------------------ 5. stock
-- NOT a direct UPDATE. Putting stock back to zero is a stock movement like
-- any other and belongs in the ledger, which is the whole reason the seed
-- used adjust_stock() too. Run this rather than touching stock_quantity:
--
--   select (adjust_stock(v.id, 'set', 0,
--             'Demo data teardown: removing demo stock',
--             'Returned to zero when the demo catalogue was torn down.',
--             null)).new_stock
--   from product_variants v
--   join products p on p.id = v.product_id
--   where p.slug in ('long-sleeve-crew-neck-tshirt',
--                    'oversized-crew-neck-tshirt',
--                    'relaxed-fit-pocket-tshirt')
--     and v.stock_quantity <> 0;
--
-- It is commented out on purpose: if the walkthrough sold any of this
-- stock, zeroing it silently rewrites what the ledger says was sold. Decide
-- first, then run it.

-- -------------------------------------------------------- verification
-- Expect: 1 published product (the polo), 0 collections, 0 demo images,
-- and null specification on all twelve.
select
  (select count(*) from products where status = 'published') as published_products,
  (select count(*) from collections) as collections,
  (select count(*) from product_images) as images,
  (select count(*) from products where made_in is not null) as with_origin,
  (select count(*) from products where composition is not null) as with_composition,
  (select count(*) from products where status = 'draft') as drafts;
