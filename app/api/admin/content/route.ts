import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { ContentRequest } from '@/lib/admin/content-schema';

export const runtime = 'nodejs';

/**
 * A21's "Save and publish" (146:2836).
 *
 * ONE UPSERT OF ALL SEVEN ROWS, not seven requests. The design has a
 * single publish action and says plainly that changes go live the moment
 * you publish, so a half-published homepage — new hero, old reassurance —
 * is the failure worth avoiding. `upsert` with an array is one statement
 * to PostgREST, which is the closest this gets to atomic without a
 * Postgres function (rule 4). If it fails, nothing moved.
 *
 * Staff, not owner-only. A22 is owner-only because those columns price a
 * basket; homepage copy is the job the shop's own people do, and the worst
 * case is wording somebody can change straight back.
 */
export async function PUT(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = ContentRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request' },
      { status: 400 },
    );
  }
  const content = parsed.data;

  // The hero button is the busiest link on the site. The editor offers a
  // closed list, and this refuses anything outside the shapes that list
  // can produce — so a hand-crafted request cannot point it at an
  // off-site URL or a path that does not exist.
  const href = content.hero.cta_href;
  const allowed =
    href === '/shop' || href === '/collections' || /^\/collections\/[a-z0-9]+(-[a-z0-9]+)*$/.test(href);
  if (!allowed) {
    return NextResponse.json(
      { error: 'The hero button must point at the shop or at one of your collections.' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const rows = (Object.keys(content) as (keyof typeof content)[]).map((key) => ({
    key,
    content: content[key],
    updated_at: now,
    updated_by: session.userId,
  }));

  const { error } = await session.supabase.from('homepage_sections').upsert(rows, { onConflict: 'key' });
  if (error) {
    return NextResponse.json({ error: 'Could not publish the homepage content.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, published_at: now });
}
