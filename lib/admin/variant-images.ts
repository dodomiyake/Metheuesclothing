import { createServerComponentClient } from '@/lib/supabase/server-component';
import { imageUrl } from '@/lib/images';

type SupabaseClient = Awaited<ReturnType<typeof createServerComponentClient>>;

export type VariantImage = { url: string; alt: string };

/**
 * A thumbnail for an ORDER LINE, which is not quite the same lookup as a
 * thumbnail for a product.
 *
 * An order line names a variant, and a variant is a colour; A05 lets an
 * image be assigned to a colour, so the picture a picker should see is the
 * one for THAT colour where it exists, an unassigned one (a fabric or
 * print detail, which belongs to every colourway) where it does not, and
 * the product's first image otherwise. Showing the BLACK photograph beside
 * a WHITE line on a pick list is how the wrong garment goes in the parcel.
 *
 * `order_items.variant_id` is nullable — 001_schema.sql nulls it if the
 * variant is ever deleted, because the row's own snapshot is the record of
 * what was bought. A line with no variant simply gets no thumbnail; the
 * product name, colour, size and SKU on it are the real record either way.
 */
export async function loadVariantImages(
  supabase: SupabaseClient,
  variantIds: (string | null | undefined)[],
): Promise<Map<string, VariantImage>> {
  const out = new Map<string, VariantImage>();
  const ids = [...new Set(variantIds.filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (ids.length === 0) return out;

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, product_id, colour')
    .in('id', ids);
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const rows = (variants ?? []) as { id: string; product_id: string; colour: string }[];
  const productIds = [...new Set(rows.map((v) => v.product_id))];
  if (productIds.length === 0) return out;

  const { data: images, error: imagesError } = await supabase
    .from('product_images')
    .select('product_id, storage_path, alt_text, colour, position')
    .in('product_id', productIds)
    .order('position');
  if (imagesError) throw new Error(`Could not load product images: ${imagesError.message}`);

  type ImageRow = { product_id: string; storage_path: string; alt_text: string; colour: string | null };
  const byProduct = new Map<string, ImageRow[]>();
  for (const row of (images ?? []) as ImageRow[]) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  for (const variant of rows) {
    const list = byProduct.get(variant.product_id) ?? [];
    const match =
      list.find((i) => i.colour === variant.colour) ?? list.find((i) => i.colour === null) ?? list[0];
    if (!match) continue;
    const url = imageUrl(match.storage_path);
    if (!url) continue;
    out.set(variant.id, { url, alt: match.alt_text });
  }

  return out;
}
