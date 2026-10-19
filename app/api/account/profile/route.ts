import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { UpdateProfileRequest } from '@/lib/account/schema';

export const runtime = 'nodejs';

/**
 * 18 Account Details' two Save buttons — personal details and contact
 * preferences — both land here.
 *
 * The write runs as the SIGNED-IN USER, not the service role, so
 * profiles_self_write is the real lock and this route cannot be tricked into
 * editing somebody else's row: the policy matches id against auth.uid().
 * The explicit .eq('id', user.id) is belt and braces for the day a policy
 * is widened by a migration that did not think about this route.
 *
 * `role` is NOT in the schema, which is the whole reason the schema is
 * strict: profiles holds it, and a lenient parse plus a spread is exactly
 * how a customer would make themselves staff.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = UpdateProfileRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const patch: Record<string, unknown> = { ...parsed.data };
  if ('full_name' in patch) patch.full_name = patch.full_name || null;
  if ('phone' in patch) patch.phone = patch.phone || null;

  // marketing_opt_in_at records WHEN consent was given, which is the part
  // that matters if anyone ever has to show it. Cleared on opt-out rather
  // than left behind claiming a consent that has been withdrawn.
  if (typeof parsed.data.marketing_opt_in === 'boolean') {
    patch.marketing_opt_in_at = parsed.data.marketing_opt_in ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: 'Could not save your details.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
