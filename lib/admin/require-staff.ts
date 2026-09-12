import 'server-only';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

/**
 * Every admin write route calls this first. It authorises with the caller's
 * own session-scoped client, not the service role -- profiles_staff_write
 * and its siblings in 002_rls.sql already say who may write the catalogue,
 * so the route asking again in application code would just be a second copy
 * of the same rule to keep in sync. The one place that isn't true is
 * inventory_adjustments (no staff INSERT policy at all -- see 010's
 * comment), which is why adjust-stock calls the service role afterwards,
 * but only once this has already confirmed the caller is staff.
 */
export async function requireStaffSession() {
  const supabase = await createRouteHandlerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }),
    } as const;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'staff' && profile.role !== 'owner')) {
    return {
      error: NextResponse.json({ error: 'Not authorised.' }, { status: 403 }),
    } as const;
  }

  return { supabase, userId: user.id, role: profile.role as 'staff' | 'owner' } as const;
}
