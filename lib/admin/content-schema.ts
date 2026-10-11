import { z } from 'zod';

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
