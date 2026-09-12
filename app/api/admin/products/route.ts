import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { CreateProductRequest } from '@/lib/admin/product-schema';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = CreateProductRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { status, ...fields } = parsed.data;

  // products_staff_write (002_rls.sql) is what actually authorises this
  // insert -- the requireStaffSession() check above is what makes a plain
  // 403 possible instead of a raw RLS violation reaching the browser.
  const { data, error } = await session.supabase
    .from('products')
    .insert({
      ...fields,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      archived_at: status === 'archived' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) {
    const knownConflict = (error as { code?: string }).code === '23505';
    return NextResponse.json(
      { error: knownConflict ? 'That slug is already in use.' : 'Could not create the product.' },
      { status: knownConflict ? 409 : 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
