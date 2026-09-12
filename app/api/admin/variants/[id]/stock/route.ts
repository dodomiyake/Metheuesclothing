import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const AdjustStockRequest = z
  .object({
    mode: z.enum(['add', 'remove', 'set']),
    amount: z.number().int().min(0),
    reason: z.string().trim().min(1).max(500),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

// adjust_stock (010_adjust_stock.sql) is service_role-only -- 002_rls.sql is
// deliberate that staff get no INSERT policy on inventory_adjustments, so
// this is the one admin write in the whole catalogue area that cannot go
// through the caller's own session. requireStaffSession() below is what
// stands in for the RLS check that route would otherwise have provided.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = AdjustStockRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { mode, amount, reason, note } = parsed.data;

  const db = createServiceClient();
  const { data, error } = await db
    .rpc('adjust_stock', {
      p_variant_id: id,
      p_mode: mode,
      p_amount: amount,
      p_reason: reason,
      p_note: note ?? null,
      p_actor: session.userId,
    })
    .single();

  if (error) {
    // adjust_stock's RAISE messages are written for a human reading this
    // screen (§9.3's rule, not a constraint name), so they pass straight
    // through rather than being replaced with a generic one.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
