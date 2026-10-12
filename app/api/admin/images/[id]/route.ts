import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { SHOP_BUCKET, isShopImagePath } from '@/lib/images';

export const runtime = 'nodejs';

const EditImage = z
  .object({
    alt_text: z.string().trim().min(1).max(500).optional(),
    colour: z.string().trim().max(100).nullable().optional(),
    /**
     * A05's "Replace". Swapping the path rather than deleting the row and
     * uploading a new one is the whole point: a delete-and-add would put
     * the picture at the END of the order, so replacing the primary image
     * would silently demote it and change what the shop listing shows.
     */
    storage_path: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = EditImage.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Describe the image before saving it.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.alt_text !== undefined) patch.alt_text = parsed.data.alt_text;
  if (parsed.data.colour !== undefined) patch.colour = parsed.data.colour?.trim() || null;
  if (parsed.data.storage_path !== undefined) {
    if (!isShopImagePath(parsed.data.storage_path)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    patch.storage_path = parsed.data.storage_path;
  }

  const { data, error } = await session.supabase
    .from('product_images')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could not save the image.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Unknown image.' }, { status: 404 });
  return NextResponse.json({ id: data.id });
}

/**
 * THE ROW GOES FIRST, THEN THE FILE, and the order is the point.
 *
 * Of the two half-failures available: a deleted row with the file still in
 * the bucket is an orphan nobody sees and storage bills a few kilobytes
 * for. A deleted file with the row still there is a broken image on the
 * shop — the customer-facing failure. So the recoverable one is chosen,
 * the same reasoning /refund's Stripe-first ordering uses.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;

  const { data: image, error: readError } = await session.supabase
    .from('product_images')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not read the image.' }, { status: 500 });
  if (!image) return NextResponse.json({ error: 'Unknown image.' }, { status: 404 });

  const { error: rowError } = await session.supabase.from('product_images').delete().eq('id', id);
  if (rowError) return NextResponse.json({ error: 'Could not remove the image.' }, { status: 500 });

  // Best effort. The row is already gone, so the shop is correct either
  // way; a failure here leaves a file nobody references.
  await session.supabase.storage.from(SHOP_BUCKET).remove([image.storage_path as string]);

  return NextResponse.json({ ok: true });
}
