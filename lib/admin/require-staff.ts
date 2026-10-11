import 'server-only';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { createServerComponentClient } from '@/lib/supabase/server-component';

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

/**
 * The same question for a Server Component: is the caller staff?
 *
 * Every other admin screen reads its data with the signed-in user's own
 * session, so RLS is the thing actually keeping a customer out — the admin
 * layout's check decides what is RENDERED, and `is_staff()` inside each
 * policy decides what is RETURNED. A19/A20 are the first screens that
 * cannot work that way: "customers" is an aggregate across orders and
 * profiles plus a verification flag out of `auth.users`, so it comes from
 * SECURITY DEFINER functions granted to service_role only (migration 016),
 * and the service client bypasses RLS entirely.
 *
 * That removes the second lock, so this puts one back in front of the
 * first. A layout is not a security boundary — it renders around a page,
 * and relying on it alone means one future route group that forgets to
 * nest is a full customer-list leak. Two lines at the top of the page cost
 * nothing by comparison.
 */
export async function requireStaffPage(): Promise<{ id: string; email: string; role: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/sign-in');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .single();

  // Same reasoning as the admin layout: a query error must not read as
  // "not staff". A real staff member should see a loud failure during an
  // outage, not a quiet demotion.
  if (error) throw new Error(`Could not confirm your access: ${error.message}`);

  if (profile?.role !== 'staff' && profile?.role !== 'owner') {
    throw new Error('This page is for staff accounts only.');
  }

  return { id: profile.id as string, email: profile.email as string, role: profile.role as string };
}
