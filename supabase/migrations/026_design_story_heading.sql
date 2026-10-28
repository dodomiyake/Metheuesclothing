-- 026: the design story's headline
--
-- 04A's "Full design story" (62:968) draws THREE things in its copy column:
-- a small eyebrow ("The story"), a 48px HEADLINE, and the body. This project
-- shipped the eyebrow and the body and omitted the headline, for the reason
-- it omits every other undrawn-but-unbacked field: no column stored one.
--
-- That omission is why the section reads empty. The frame's copy block is
-- 182px tall against a 600px photograph; ours is two lines, so the band has
-- four hundred pixels of black under the text -- reported as "this is a waste
-- of space". The headline is not decoration, it is the missing third of a
-- three-part block.
--
-- WHY A COLUMN AND NOT products.name. The frame's own headline is
-- "Frequency One" where the product is "Frequency One Tee" -- a DESIGN name,
-- deliberately not the catalogue name, which is already the page title forty
-- pixels up. Reusing `name` would print the same words twice in one
-- viewport, which is worse than the empty space it replaces.
--
-- Additive, nullable, no default. A product without one renders the section
-- exactly as it does today, so this cannot break a page: it can only fill
-- one. 200 characters because it is a line, not a paragraph -- the body
-- column beside it already takes 5000.
--
-- No SECURITY DEFINER function here, so rule 3 has nothing to check. RLS is
-- unchanged: `products` already has its policies and a new column inherits
-- them. 020 revoked column-level UPDATE on `profiles` and not on this table,
-- so nothing needs granting either.

alter table products
  add column if not exists design_story_heading text;

comment on column products.design_story_heading is
  'The 48px headline 04A draws above the design story body (62:968). A DESIGN name, not the catalogue name -- products.name is already the page title. Null renders the section without it.';
