import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * A18's "Mark received". Nothing in this codebase could set that state
 * before, which meant no return could ever be approved — approval requires
 * the parcel to be here, because approval is what puts stock back.
 *
 * No body: the only thing being said is "it arrived", and the actor comes
 * from the session.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const db = createServiceClient();

  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.userId)
    .single();

  const { data, error } = await db.rpc('receive_return', {
    p_return_id: id,
    p_actor: session.userId,
    p_actor_label: profile?.full_name || profile?.email || 'Staff',
  });

  // receive_return names the return and its state; that message is written
  // for whoever is standing at the bench.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: data });
}
