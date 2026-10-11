import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { CreateCollectionRequest, publishedAt } from '@/lib/admin/collection-schema';

export const runtime = 'nodejs';

/** A09's "New collection" (145:2507). */
export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = CreateCollectionRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { status, published_at, ...fields } = parsed.data;

  // A new collection goes to the END of the order, not the front. The list
  // is drag-ordered and that order is the menu order the owner chose; a new
  // row inserting itself at position 0 would silently reorder the shop.
  const { data: last, error: lastError } = await session.supabase
    .from('collections')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) {
    return NextResponse.json({ error: 'Could not read the collection order.' }, { status: 500 });
  }

  const { data, error } = await session.supabase
    .from('collections')
    .insert({
      ...fields,
      status,
      position: ((last?.position as number) ?? -1) + 1,
      published_at: publishedAt(status, published_at ?? null, null),
    })
    .select('id')
    .single();

  if (error) {
    const conflict = (error as { code?: string }).code === '23505';
    return NextResponse.json(
      { error: conflict ? 'That handle is already in use.' : 'Could not create the collection.' },
      { status: conflict ? 409 : 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
