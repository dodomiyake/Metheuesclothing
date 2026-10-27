-- Metheues Clothings — DEMO DATA, part 2: collections
--
-- There were ZERO collections on the live database, which is why
-- `/collections`, `/collections/[slug]` (screen 19) and A09 had all only ever
-- rendered their empty states. The write paths were built and unexercised;
-- CLAUDE.md said "creating the first one is the test". This is that test as
-- well as demo data.
--
-- FIXED UUIDS, so `99-teardown.sql` can remove exactly these rows and
-- nothing else. They are deliberately obvious (dd00...0001) rather than
-- random: a teardown that matches on a name or a slug breaks the moment
-- somebody renames something, and one that matches on a date removes real
-- work done the same afternoon.
--
-- LIVE RATHER THAN HIDDEN, which is the opposite of what A09 does for a
-- collection a person creates. A new collection starts hidden there on
-- purpose — "creating something and having it hit the shop the same second,
-- before it has a description or a single T-shirt, is the one default that
-- cannot be undone quietly". These arrive complete and the whole point is to
-- see them on the storefront, so they are live from the start. Worth knowing
-- that `status = 'hidden'` would make the page 404 for a customer, because
-- the RLS policy is `status = 'live' or is_staff()` — the design's footer
-- claims a hidden collection stays reachable by its address and the database
-- disagrees, which is already on the design owner's list.
--
-- `published_at` is screen 19's RELEASED field. `hero_path` is left null here
-- and filled by part 3, because the hero is an uploaded file rather than a
-- string — and screen 19 falls back to the same well every unphotographed
-- surface shows, so the page works either way.
--
-- EVERY PRODUCT IS IN CORE and only the two wide cuts are in the Oversized
-- Edit, so the collection facet on the shop listing has something real to
-- filter by and the two collection pages do not look identical.

insert into collections (id, slug, name, description, hero_alt, status, position, published_at, seo_title, seo_description)
values
  ('dd000000-0000-4000-8000-000000000001',
   'core',
   'CORE',
   'The shapes we keep making. Four cuts, the same cotton, restocked rather than retired.',
   'A folded stack of plain cotton T-shirts in black, bone and ivory on a pale background.',
   'live', 0, now(),
   'CORE collection - Metheues Clothings',
   'The T-shirts we keep in stock all year: regular, oversized and relaxed cuts in combed cotton.'),
  ('dd000000-0000-4000-8000-000000000002',
   'oversized-edit',
   'THE OVERSIZED EDIT',
   'The wider cuts, together. Dropped shoulders, boxy bodies, heavier cotton so they hold their shape.',
   'Three oversized cotton crew neck T-shirts in black and bone hanging from a black rail, showing their dropped shoulder seams and wide bodies.',
   'live', 1, now(),
   'The Oversized Edit - Metheues Clothings',
   'Boxy, dropped-shoulder T-shirts in a heavier combed cotton. Sized to be worn as they are.')
on conflict (id) do nothing;

-- Membership. `product_collections`' primary key is (product_id,
-- collection_id) in that order, which is what A10's upsert names.
insert into product_collections (product_id, collection_id, position)
select p.id, 'dd000000-0000-4000-8000-000000000001', x.pos
from (values
  ('striped-short-sleeve-polo-tshirt', 0),
  ('oversized-crew-neck-tshirt', 1),
  ('long-sleeve-crew-neck-tshirt', 2),
  ('relaxed-fit-pocket-tshirt', 3)
) as x(slug, pos)
join products p on p.slug = x.slug
on conflict (product_id, collection_id) do nothing;

insert into product_collections (product_id, collection_id, position)
select p.id, 'dd000000-0000-4000-8000-000000000002', x.pos
from (values
  ('oversized-crew-neck-tshirt', 0),
  ('relaxed-fit-pocket-tshirt', 1)
) as x(slug, pos)
join products p on p.slug = x.slug
on conflict (product_id, collection_id) do nothing;
