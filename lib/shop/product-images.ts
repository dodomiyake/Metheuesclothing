import { createServerComponentClient } from '@/lib/supabase/server-component';
import { imageUrl } from '@/lib/images';

type SupabaseClient = Awaited<ReturnType<typeof createServerComponentClient>>;

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  colour: string | null;
};

type Row = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string;
  colour: string | null;
  position: number;
};

/**
 * The reader half of the image pipeline. A05 writes `product_images` rows;
 * without this nothing a customer looks at would change after an upload.
 *
 * POSITION IS THE CURATION, which is why every query here orders by it and
 * "primary" means position 0 rather than "newest" or "first returned".
 * A05's drag list is the only thing that sets it.
 *
 * imageUrl() returning null is a real case, not a defensive flourish:
 * NEXT_PUBLIC_SUPABASE_URL is absent in some build contexts, and a row
 * whose URL cannot be built is dropped rather than rendered as a broken
 * <img>. Callers fall back to the placeholder well they used before any
 * photography existed.
 */
export async function loadPrimaryImages(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, ProductImage>> {
  const byProduct = new Map<string, ProductImage>();
  if (productIds.length === 0) return byProduct;

  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, storage_path, alt_text, colour, position')
    .in('product_id', productIds)
    .order('position');

  // Same rule as every other catalogue query here (CLAUDE.md's swallowed-
  // error note): `data` is null for a failed query and for no rows alike.
  // A missing photograph is a placeholder well, which is a legitimate
  // state; a database that cannot be reached is not, and must be loud.
  if (error) throw new Error(`Could not load product images: ${error.message}`);

  for (const row of (data ?? []) as Row[]) {
    if (byProduct.has(row.product_id)) continue; // ordered by position, so the first is position 0
    const url = imageUrl(row.storage_path);
    if (!url) continue;
    byProduct.set(row.product_id, { id: row.id, url, alt: row.alt_text, colour: row.colour });
  }

  return byProduct;
}

/** Every image for one product, in curated order — the PDP gallery. */
export async function loadProductImages(
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, storage_path, alt_text, colour, position')
    .eq('product_id', productId)
    .order('position');
  if (error) throw new Error(`Could not load product images: ${error.message}`);

  const images: ProductImage[] = [];
  for (const row of (data ?? []) as Row[]) {
    const url = imageUrl(row.storage_path);
    if (!url) continue;
    images.push({ id: row.id, url, alt: row.alt_text, colour: row.colour });
  }
  return images;
}
