import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { UpdateAddressRequest } from '@/lib/account/schema';

export const runtime = 'nodejs';

/** 30's "Edit" and "Set as default". Clear-then-set, for the reason POST gives. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { id } = await params;
  const parsed = UpdateAddressRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { is_default, ...fields } = parsed.data;

  if (is_default === true) {
    const { error: clearError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', user.id)
      .eq('is_default', true)
      .neq('id', id);
    if (clearError) {
      return NextResponse.json({ error: 'Could not update that address.' }, { status: 500 });
    }
  }

  const patch: Record<string, unknown> = { ...fields };
  if (typeof is_default === 'boolean') patch.is_default = is_default;

  // .eq('profile_id') as well as the policy: addresses_own already scopes
  // this to the caller, and saying it here too means a future policy change
  // cannot quietly widen what this route can touch.
  const { data, error } = await supabase
    .from('addresses')
    .update(patch)
    .eq('id', id)
    .eq('profile_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could not update that address.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No such address.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

/**
 * 30's "Remove".
 *
 * Deleting the DEFAULT leaves a customer with none, so the next address
 * (oldest first, which is the order the page lists them in) is promoted.
 * Doing nothing would mean checkout quietly offering no address at all,
 * and the unique partial index means only one can hold the flag anyway.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { id } = await params;

  const { data: existing, error: readError } = await supabase
    .from('addresses')
    .select('id, is_default')
    .eq('id', id)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not remove that address.' }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'No such address.' }, { status: 404 });

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not remove that address.' }, { status: 500 });

  if (existing.is_default) {
    const { data: next } = await supabase
      .from('addresses')
      .select('id')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await supabase.from('addresses').update({ is_default: true }).eq('id', next.id);
    }
  }

  return NextResponse.json({ ok: true });
}
