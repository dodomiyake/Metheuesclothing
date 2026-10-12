import { z } from 'zod';
import { isShopImagePath } from '@/lib/images';

/**
 * A21 Store content. One request carrying all seven §9.7 slots, because
 * that is what "Save and publish" does — the screen has no per-section
 * save and the design is explicit that publishing is one act.
 *
 * `.strict()` at every level. The slots are a FIXED set with fixed shapes
 * ("a limited content system, not a general page builder"), so a client
 * sending a key this does not name should get a 400 rather than quietly
 * writing a row the homepage will never read.
 */
const Line = z.string().trim().max(300);
const Body = z.string().trim().max(1200);

export const ContentRequest = z
  .object({
    announcement: z
      .object({ message: Line.max(160), visible: z.boolean() })
      .strict(),
    hero: z
      .object({
        title: Line,
        body: Body,
        cta_label: Line.max(60),
        // A SELECT in the design, not a text field, and kept that way: a
        // typo in a free-text destination is a 404 on the busiest button
        // in the shop. The route checks it resolves, below.
        cta_href: Line.max(300),
        // The campaign photograph, as a bucket path (migration 019). Checked
        // against isShopImagePath for the same reason collections.hero_path
        // is: this string becomes an <img src> on the homepage, so free text
        // here would be an arbitrary URL there.
        image_path: z
          .string()
          .trim()
          .refine(isShopImagePath, 'Not an uploaded image path')
          .nullable(),
        // Empty is a real answer — the hero's words sit beside it in text,
        // so decoration is legitimate. product_images.alt_text is NOT NULL
        // precisely because a product photograph is not.
        image_alt: Line.max(500),
      })
      .strict(),
    featured_drop: z
      .object({
        eyebrow: Line.max(60),
        title: Line,
        collection_slug: z.string().trim().max(200).nullable(),
      })
      .strict(),
    featured_products: z.object({ slugs: z.array(z.string().trim().max(200)).max(4) }).strict(),
    story: z.object({ eyebrow: Line.max(60), title: Line, body: Body }).strict(),
    craft: z
      .object({
        eyebrow: Line.max(60),
        title: Line,
        body: Body,
        specs: z
          .array(z.object({ label: Line.max(60), value: Line.max(120) }).strict())
          .max(6),
      })
      .strict(),
    newsletter: z.object({ title: Line, body: Body }).strict(),
    reassurance: z
      .object({
        items: z.array(z.object({ title: Line.max(60), body: Line }).strict()).max(3),
      })
      .strict(),
  })
  .strict();

export type ContentPayload = z.infer<typeof ContentRequest>;
