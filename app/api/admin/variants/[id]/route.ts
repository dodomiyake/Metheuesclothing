import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';

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
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = UpdateVariantRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { error } = await session.supabase.from('product_variants').update(parsed.data).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Could not update the variant.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
