import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { UpdateProductRequest } from '@/lib/admin/product-schema';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = UpdateProductRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.status) {
    // published_at/archived_at are set once, on the transition into that
    // status, not on every subsequent edit -- otherwise re-saving a
    // published product would keep pushing its publish date forward.
    const { data: current } = await session.supabase
      .from('products')
      .select('status, published_at, archived_at')
      .eq('id', id)
      .single();

    if (parsed.data.status === 'published' && !current?.published_at) {
      patch.published_at = new Date().toISOString();
    }
    if (parsed.data.status === 'archived' && !current?.archived_at) {
      patch.archived_at = new Date().toISOString();
    }
  }

  const { data, error } = await session.supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    const knownConflict = (error as { code?: string }).code === '23505';
    return NextResponse.json(
      { error: knownConflict ? 'That slug is already in use.' : 'Could not save the product.' },
      { status: knownConflict ? 409 : 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Unknown product.' }, { status: 404 });
  }

  return NextResponse.json({ id: data.id });
}
