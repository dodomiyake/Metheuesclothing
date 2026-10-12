-- The image pipeline. There has never been one.
--
-- `product_images` has existed since migration 001 and holds zero rows,
-- because nothing in this codebase can put a file anywhere: no bucket, no
-- upload route, no reader. Every product card, the product gallery, the
-- collection hero and the homepage hero are grey placeholder wells, and
-- A05 Product image manager is the one admin screen of twenty-three that
-- was never built. This is the half that lives in the database.
--
-- ONE PUBLIC BUCKET, not one per thing. Product shots, collection heroes
-- and the homepage campaign are all the same kind of object — a picture
-- the whole internet is meant to see — and splitting them would mean three
-- sets of policies saying the same sentence. They are separated by path
-- prefix instead: products/<product_id>/<uuid>.<ext>,
-- collections/<collection_id>/<uuid>.<ext>, homepage/<uuid>.<ext>.
--
-- PUBLIC READ IS THE POINT. These are shop photographs; a signed URL per
-- image would mean every catalogue page round-tripping to Supabase for
-- every thumbnail, and nothing here is private. Write is staff-only, which
-- is what actually needs guarding.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-images',
  'shop-images',
  true,
  -- 10 MB. A 4:5 product shot has no business being larger, and the limit
  -- is enforced by storage rather than by a form that can be bypassed.
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Anyone may read. The bucket being public already allows this at the API
-- level; the policy is what makes it true for direct storage queries too.
create policy "shop images are public to read"
  on storage.objects for select
  using (bucket_id = 'shop-images');

-- Only staff may write, and only through a signed upload URL this app
-- issues — the same shape as every other admin write here: is_staff() is
-- the real lock, the route is what turns a refusal into a 403 rather than
-- a raw policy violation.
create policy "staff may upload shop images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-images' and is_staff());

create policy "staff may replace shop images"
  on storage.objects for update to authenticated
  using (bucket_id = 'shop-images' and is_staff())
  with check (bucket_id = 'shop-images' and is_staff());

create policy "staff may delete shop images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'shop-images' and is_staff());

-- A product's images are ORDERED, and A05's first tile is the primary one.
-- Without this two images can share a position and the "primary" image
-- becomes whichever row the database happens to return first — which is
-- not stable, and would make the card on the shop listing change picture
-- between page loads.
create unique index if not exists product_images_one_per_position
  on product_images (product_id, position);

-- The homepage hero has no column anywhere: §9.7 makes the hero a content
-- slot, and that slot is jsonb, so its image path lives in the slot
-- alongside its heading. Nothing to add here. collections.hero_path and
-- collections.hero_alt already exist (001) and are read by screen 19 the
-- moment something writes them.
