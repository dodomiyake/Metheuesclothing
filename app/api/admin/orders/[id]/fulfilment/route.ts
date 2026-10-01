import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const AdvanceRequest = z
  .object({
    // Only the packing steps. Shipping goes through /ship, because that is
    // also what emails the customer — see 011_fulfilment.sql.
    to: z.enum(['processing', 'packed']),
  })
  .strict();

/**
 * A13's "Mark packed" (and starting work on an order).
 *
 * advance_fulfilment (011) is service_role-only for the same reason
 * adjust_stock is: staff can UPDATE orders under orders_staff_write, but
 * audit_logs is "insert-by-server, read-by-staff" per 002_rls.sql, and an
 * append-only log the actor writes directly is not append-only in any
 * useful sense. requireStaffSession() is what stands in for the RLS check
 * before the service role is used.
 *
 * The legal transitions live in the function, not here. A route that knows
 * the state machine is a second copy of it to keep in sync, and this one
 * would be the copy that drifts — the function is also what a future
 * script or a second route would call.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = AdvanceRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = createServiceClient();

  // The audit row records a person, not a user id — audit_logs.actor_label
  // is NOT NULL and is what the A12 panel actually shows.
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.userId)
    .single();

  const { data, error } = await db.rpc('advance_fulfilment', {
    p_order_id: id,
    p_to: parsed.data.to,
    p_actor: session.userId,
    p_actor_label: profile?.full_name || profile?.email || 'Staff',
  });

  if (error) {
    // advance_fulfilment's RAISE messages name the order and its current
    // state ("order MC-10482 is already packed"), which is what the person
    // on A13 needs to read. Passing them through beats a generic 400.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ fulfilment_status: data });
}
