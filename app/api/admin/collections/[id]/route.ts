import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { UpdateCollectionRequest, publishedAt } from '@/lib/admin/collection-schema';

export const runtime = 'nodejs';

/** A10's "Save changes" (145:2843). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = UpdateCollectionRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.status) {
    const { data: current, error: currentError } = await session.supabase
      .from('collections')
      .select('published_at')
      .eq('id', id)
      .maybeSingle();
    if (currentError) {
      return NextResponse.json({ error: 'Could not read the collection.' }, { status: 500 });
    }
    patch.published_at = publishedAt(
      parsed.data.status,
      parsed.data.published_at ?? null,
      (current?.published_at as string | null) ?? null,
    );
  }

  const { data, error } = await session.supabase
    .from('collections')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    const conflict = (error as { code?: string }).code === '23505';
    return NextResponse.json(
      { error: conflict ? 'That handle is already in use.' : 'Could not save the collection.' },
      { status: conflict ? 409 : 500 },
    );
  }
  if (!data) return NextResponse.json({ error: 'Unknown collection.' }, { status: 404 });

  return NextResponse.json({ id: data.id });
}
