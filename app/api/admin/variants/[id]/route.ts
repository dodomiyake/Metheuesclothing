import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/admin/audit';
import { formatPence } from '@/lib/money';

export const runtime = 'nodejs';

const UpdateVariantRequest = z
  .object({
    is_active: z.boolean().optional(),
    price_pence: z.number().int().min(0).optional(),
  })
  .strict();

// product_variants_staff_write (002_rls.sql) authorises this directly, same
// as the product routes -- stock is deliberately NOT here, see
// /api/admin/variants/[id]/stock.
//
// A PRICE CHANGE IS AUDITED, which A23's frame draws (146:3802, "£54.00 to
// £58.00 · applies to new orders only") and nothing wrote. It is the one
// edit here that changes what a customer is charged, and unlike the
// delivery prices in A22 it can be made by any staff member. Note that no
// screen in the admin currently edits a price at all — the variant manager
// shows it read-only and A06 sets it at creation — so this route is the
// only way one can move, which is exactly why the row belongs here rather
// than in whichever screen eventually draws the field.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = UpdateVariantRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Read before the write, so the summary can say what the price WAS. The
  // SKU comes with it because that is what the design's entry is headed
  // with and what a staff member searches the log for.
  let before: { price_pence: number; sku: string } | null = null;
  if (parsed.data.price_pence !== undefined) {
    const { data } = await session.supabase
      .from('product_variants')
      .select('price_pence, sku')
      .eq('id', id)
      .single();
    before = data ?? null;
  }

  const { error } = await session.supabase.from('product_variants').update(parsed.data).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Could not update the variant.' }, { status: 500 });
  }

  // After the update, and only when the number actually moved — an append-
  // only log cannot retract an entry, and a row per re-save would bury the
  // changes that matter.
  if (before && parsed.data.price_pence !== undefined && before.price_pence !== parsed.data.price_pence) {
    await writeAuditLog(createServiceClient(), {
      actorId: session.userId,
      action: 'price_changed',
      entityType: 'variant',
      entityId: id,
      summary: `${before.sku}: ${formatPence(before.price_pence)} to ${formatPence(
        parsed.data.price_pence,
      )}. Applies to new orders only — orders already placed keep the price they were charged.`,
    });
  }

  return NextResponse.json({ ok: true });
}
