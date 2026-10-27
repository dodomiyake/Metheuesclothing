import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { STOCK_PROVIDER_INFO } from '@/lib/stock-photos';
import { ImageManager, type ManagedImage } from './image-manager';

/**
 * A05 Product image manager — Figma 134:1352 (Desktop) / 134:1169
 * (Tablet). The last of the twenty-three admin screens, and the one that
 * needed a pipeline built under it first (migration 019).
 *
 * NOT BEHIND WideOnly, although A05 is on `admin_breakpoint_decision`'s
 * no_mobile list. The owner lifted it for this screen on 18 October and
 * the exception is recorded in the ledger beside the rule itself.
 * THE PHOTOGRAPHS ARE ON THE PHONE — gating the one screen whose input
 * lives on the device you are holding is the gate working against its own
 * purpose, and the recorded REASON for the rule is density ("dense tables
 * and multi-section editors fight a 390px screen"), which this is not: it
 * is a thumbnail grid and a side panel, and it reflows to two thumbs per
 * row. A19 Customers and A23 Audit log are the same shape of exception.
 * The frames are still Desktop and Tablet only, so 390 here is
 * implementation beyond what the design file draws rather than a frame
 * nobody built.
 */
export default async function ProductImagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const [productQuery, imagesQuery, variantsQuery] = await Promise.all([
    supabase.from('products').select('id, name').eq('id', id).maybeSingle(),
    supabase
      .from('product_images')
      .select('id, storage_path, alt_text, colour, position, created_at')
      .eq('product_id', id)
      .order('position'),
    supabase.from('product_variants').select('colour').eq('product_id', id),
  ]);

  // A query error and an unknown id both leave `data` null; only the
  // second is a 404 (CLAUDE.md's swallowed-error note).
  if (productQuery.error) throw new Error(`Could not load the product: ${productQuery.error.message}`);
  if (!productQuery.data) notFound();
  if (imagesQuery.error) throw new Error(`Could not load the images: ${imagesQuery.error.message}`);
  if (variantsQuery.error) throw new Error(`Could not load the colours: ${variantsQuery.error.message}`);

  // The colours an image can be assigned to are the product's REAL variant
  // colours, deduplicated — not a list typed into this screen. Assigning
  // an image to a colour nothing is sold in would be an image nobody ever
  // sees.
  const colours = [...new Set((variantsQuery.data ?? []).map((v) => v.colour as string))].sort();

  return (
    <ImageManager
      productId={productQuery.data.id as string}
      productName={productQuery.data.name as string}
      initial={(imagesQuery.data ?? []) as ManagedImage[]}
      colours={colours}
      stockProviders={STOCK_PROVIDER_INFO}
    />
  );
}
