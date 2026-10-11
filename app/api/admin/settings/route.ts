import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { UpdateSettingsRequest } from '@/lib/admin/settings-schema';

export const runtime = 'nodejs';

/**
 * A22's "Save settings" (146:3295).
 *
 * OWNER ONLY, not staff. Every other admin write here is gated on
 * `is_staff()`, and that is right for packing a parcel or answering a
 * return. These columns decide what a customer is charged and how long
 * they have to send something back, and A22's own staff card draws the
 * line in exactly this place: "Staff — orders, fulfilment and returns, no
 * settings". `is_owner()` has existed since 002 and nothing has ever used
 * it; this is what it was for.
 *
 * store_settings has no owner-only RLS policy — the staff write policy is
 * the only one on it — so the check lives here. Narrowing the policy itself
 * would be the stronger move and is a migration; worth doing, and noted
 * rather than quietly skipped.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only an owner can change store settings. These numbers decide what customers pay.' },
      { status: 403 },
    );
  }

  const parsed = UpdateSettingsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request' },
      { status: 400 },
    );
  }

  const { data, error } = await session.supabase
    .from('store_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could not save the settings.' }, { status: 500 });
  // The singleton row is seeded by migration 008. If it is missing, the
  // thing to do is say so loudly rather than insert one with values nobody
  // chose — 008's own comment is about exactly that failure.
  if (!data) {
    return NextResponse.json(
      { error: 'store_settings has no row. That is a database problem, not a form problem.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
