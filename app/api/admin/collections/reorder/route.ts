import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { ReorderCollectionsRequest } from '@/lib/admin/collection-schema';

export const runtime = 'nodejs';

/**
 * A09's drag list (145:2511). The order of the collections themselves.
 *
 * Sent as the whole list rather than one moved id and a target index: the
 * list is short, and a whole-list write cannot leave two collections
 * claiming the same position the way a pair of single-row updates racing
 * each other can.
 *
 * There is no transaction here either, and unlike membership a half-applied
 * reorder is harmless — some collections move, the rest do not, and the next
 * drag fixes it. Nothing is lost, so this does not need a function.
 */
export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = ReorderCollectionsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const ids = parsed.data.collection_ids;
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const results = await Promise.all(
    ids.map((id, position) =>
      session.supabase.from('collections').update({ position }).eq('id', id).select('id').maybeSingle(),
    ),
  );

  const failed = results.filter((r) => r.error || !r.data).length;
  if (failed) {
    return NextResponse.json(
      { error: `Could not move ${failed} of ${ids.length}. Reload and try again.` },
      { status: 500 },
    );
  }

  return NextResponse.json({ count: ids.length });
}
