import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { isShopImagePath } from '@/lib/images';

export const runtime = 'nodejs';

const AddImage = z
  .object({
    product_id: z.string().uuid(),
    storage_path: z.string().trim().min(1).max(500),
    // NOT optional, and not allowed to be blank. `product_images.alt_text`
    // is NOT NULL with a non-empty check (001_schema.sql:107) because §13
    // requires text alternatives and whoever wrote that schema decided an
    // undescribed image should not be representable. The form asks for it
    // at upload time for the same reason.
    alt_text: z.string().trim().min(1).max(500),
    colour: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

/** Records an image that has already been uploaded to storage. */
export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = AddImage.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.path.includes('alt_text') ? 'Describe the image before saving it.' : 'Invalid request' },
      { status: 400 },
    );
  }

  // The path must be one this app could have issued. Without this a row
  // could point at any object in the bucket, including one belonging to a
  // different product.
  if (!isShopImagePath(parsed.data.storage_path)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // New images go on the END. The first tile is the primary one (A05), and
  // an upload quietly becoming the card everyone sees on the shop listing
  // is not what "add a photo" means.
  const { data: last, error: lastError } = await session.supabase
    .from('product_images')
    .select('position')
    .eq('product_id', parsed.data.product_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return NextResponse.json({ error: 'Could not read the order.' }, { status: 500 });

  const { data, error } = await session.supabase
    .from('product_images')
    .insert({
      product_id: parsed.data.product_id,
      storage_path: parsed.data.storage_path,
      alt_text: parsed.data.alt_text,
      colour: parsed.data.colour?.trim() || null,
      position: ((last?.position as number) ?? -1) + 1,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'Could not save the image.' }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

const Reorder = z
  .object({ product_id: z.string().uuid(), image_ids: z.array(z.string().uuid()).max(40) })
  .strict();

/**
 * The running order, which is also which image is primary.
 *
 * `product_images_one_per_position` (019) makes (product_id, position)
 * unique, which is what stops two images claiming the same slot and the
 * card picking whichever row came back first. It also means a naive
 * "set each to its new index" collides partway through, so every row goes
 * to a negative staging position first and then to its real one. Two
 * passes, no transaction available (rule 4) — and a half-applied reorder
 * leaves images at negative positions, which sorts them correctly anyway
 * and is fixed by saving again.
 */
export async function PUT(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = Reorder.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { product_id, image_ids } = parsed.data;
  if (new Set(image_ids).size !== image_ids.length) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  for (const [i, id] of image_ids.entries()) {
    const { error } = await session.supabase
      .from('product_images')
      .update({ position: -1 - i })
      .eq('id', id)
      .eq('product_id', product_id);
    if (error) return NextResponse.json({ error: 'Could not reorder the images.' }, { status: 500 });
  }
  for (const [i, id] of image_ids.entries()) {
    const { error } = await session.supabase
      .from('product_images')
      .update({ position: i })
      .eq('id', id)
      .eq('product_id', product_id);
    if (error) {
      return NextResponse.json(
        { error: 'The order was half-applied. Reload and set it again.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ count: image_ids.length });
}
