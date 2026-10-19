import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { CreateAddressRequest } from '@/lib/account/schema';

export const runtime = 'nodejs';

/**
 * 30 Saved Addresses' "Add a new address".
 *
 * Runs as the signed-in user, so addresses_own is the real lock —
 * profile_id is taken from the session rather than the body, which is what
 * stops this saving an address onto someone else's account.
 *
 * THE DEFAULT IS CLEARED BEFORE IT IS SET, in that order, and the order is
 * the point. `addresses_one_default_per_profile` is a unique partial index,
 * so setting a second default before clearing the first is refused by the
 * database; clearing first and failing to set leaves a customer with NO
 * default, which checkout reads as "no address preselected" — visible,
 * harmless and fixed by pressing the button again. Rule 4 would put the
 * pair in a Postgres function and that is still the better home; this is
 * recoverable as written, which the other order is not.
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = CreateAddressRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { is_default, ...fields } = parsed.data;

  // The first address saved is the default whatever the form says — a
  // customer with exactly one address and no default would be offered
  // nothing at checkout.
  const { count, error: countError } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true });
  if (countError) {
    return NextResponse.json({ error: 'Could not save that address.' }, { status: 500 });
  }
  const makeDefault = is_default || (count ?? 0) === 0;

  if (makeDefault) {
    const { error: clearError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', user.id)
      .eq('is_default', true);
    if (clearError) {
      return NextResponse.json({ error: 'Could not save that address.' }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...fields, profile_id: user.id, is_default: makeDefault })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'Could not save that address.' }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
