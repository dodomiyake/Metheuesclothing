import { z } from 'zod';
import { isShopImagePath } from '@/lib/images';

/**
 * Shared between POST /api/admin/collections and
 * PATCH /api/admin/collections/[id] (A09's "New collection" and A10).
 *
 * Same convention as product-schema.ts: every optional field is
 * `.nullable().optional()`, because omitted means "leave it alone" on a
 * PATCH and an explicit null means "clear it". Without both there is no way
 * to blank a description once it has been set.
 *
 * `.strict()` on both requests, for the reason every schema here is strict:
 * a client sending a field this does not name gets a 400 rather than having
 * it silently ignored — which is how `position` would otherwise be writable
 * from the editor and disagree with the reorder endpoint that owns it.
 */
export const CollectionFields = {
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  status: z.enum(['scheduled', 'live', 'hidden']),
  description: z.string().trim().max(2000).nullable().optional(),
  // hero_path IS writable now (migration 019 and A10's hero field), and it
  // is checked against isShopImagePath rather than accepted as free text:
  // the column ends up in an <img src> on a public page, so an arbitrary
  // string here would be an arbitrary URL there. Only a path this app's own
  // sign route could have issued passes.
  hero_path: z
    .string()
    .trim()
    .refine(isShopImagePath, 'Not an uploaded image path')
    .nullable()
    .optional(),
  hero_alt: z.string().trim().max(500).nullable().optional(),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(500).nullable().optional(),
  // A 'scheduled' collection needs a date to be scheduled FOR. Nothing in
  // this system promotes it when that date passes — see A10's Publishing
  // panel, which says so rather than implying a cron that does not exist.
  published_at: z.string().datetime().nullable().optional(),
};

export const CreateCollectionRequest = z.object(CollectionFields).strict();

export const UpdateCollectionRequest = z
  .object({
    ...CollectionFields,
    name: CollectionFields.name.optional(),
    slug: CollectionFields.slug.optional(),
    status: CollectionFields.status.optional(),
  })
  .strict();

/** The whole ordered membership of one collection, as A10's drag list sends
 * it: product ids in the order they should appear on the collection page. */
export const SetCollectionProductsRequest = z
  .object({ product_ids: z.array(z.string().uuid()).max(500) })
  .strict();

/** A09's drag list: every collection id in its new order. */
export const ReorderCollectionsRequest = z
  .object({ collection_ids: z.array(z.string().uuid()).min(1).max(200) })
  .strict();

/**
 * published_at means "when this went (or goes) live", and it is the column
 * the storefront's RELEASED row reads (screen 19, 121:5711).
 *
 *  - live:      stamped once, on the transition. Re-saving a live
 *               collection must not keep pushing its release date forward —
 *               the same trap products/[id] already documents.
 *  - scheduled: whatever date the editor chose, which is the whole point.
 *  - hidden:    left exactly as it was. Hiding a collection is not
 *               un-releasing it, and clearing the date would lose when it
 *               first went out.
 */
export function publishedAt(
  status: 'scheduled' | 'live' | 'hidden',
  chosen: string | null,
  current: string | null,
): string | null {
  if (status === 'scheduled') return chosen;
  if (status === 'live') return current ?? chosen ?? new Date().toISOString();
  return current;
}
