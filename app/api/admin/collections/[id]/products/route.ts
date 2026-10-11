import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { SetCollectionProductsRequest } from '@/lib/admin/collection-schema';

export const runtime = 'nodejs';

/**
 * A10's product list: which T-shirts are in this collection, and in what
 * order (145:2888). The order IS what the collection page renders in —
 * screen 19 sorts by product_collections.position.
 *
 * THE ORDER OF THE TWO WRITES IS THE WHOLE DESIGN OF THIS ROUTE, for the
 * same reason /refund's is. The Supabase JS client has no transaction
 * (CLAUDE.md rule 4), so a two-statement membership change can half-fail,
 * and the question is which half you would rather be left with:
 *
 *   upsert first, then delete  ->  a failure leaves EXTRA members. Visible
 *                                  on the next load, fixed by saving again.
 *   delete first, then upsert  ->  a failure leaves a collection EMPTY. The
 *                                  curation is gone and nothing says what
 *                                  used to be in it.
 *
 * So the upsert goes first. Rule 4 would have this in a Postgres function,
 * and it is the better home for it, but a function needs a migration and
 * this shape is recoverable by re-saving — which the one it replaces is
 * not. Worth moving if membership ever grows a second writer.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = SetCollectionProductsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const ids = parsed.data.product_ids;
  // A product listed twice would be two rows with the same primary key.
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'A T-shirt cannot be in a collection twice.' }, { status: 400 });
  }

  if (ids.length) {
    const { error: upsertError } = await session.supabase
      .from('product_collections')
      .upsert(
        ids.map((product_id, position) => ({ collection_id: id, product_id, position })),
        { onConflict: 'product_id,collection_id' },
      );
    if (upsertError) {
      return NextResponse.json({ error: 'Could not save the running order.' }, { status: 500 });
    }
  }

  // Everything that is no longer a member. Scoped to this collection, and
  // expressed as "not in the list" rather than "delete all then re-add", so
  // the rows that stay are never gone even for a moment.
  let remove = session.supabase.from('product_collections').delete().eq('collection_id', id);
  if (ids.length) remove = remove.not('product_id', 'in', `(${ids.join(',')})`);
  const { error: removeError } = await remove;
  if (removeError) {
    return NextResponse.json(
      { error: 'The running order was saved, but removing the T-shirts you took out failed. Save again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ count: ids.length });
}
