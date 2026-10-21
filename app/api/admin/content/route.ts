import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { ContentRequest } from '@/lib/admin/content-schema';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/admin/audit';

export const runtime = 'nodejs';

/** What each slot is called in the audit entry. The keys are the storage
 *  names; a staff member reading the log has never seen them. */
const SLOT_NAMES: Record<string, string> = {
  announcement: 'the announcement bar',
  hero: 'the hero',
  featured_drop: 'the featured drop',
  featured_products: 'the featured T-shirts',
  story: 'the story section',
  craft: 'the craft section',
  newsletter: 'the newsletter text',
  reassurance: 'the delivery highlights',
};

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

  // Read before the write so the audit entry can name WHICH slots moved.
  // A21 publishes all eight every time by design, so without this the only
  // honest summary would be "the homepage was republished" — true, and
  // useless for answering "who changed the hero heading". The design's own
  // entry (146:3768) says "Hero heading and 2 highlights changed".
  const { data: existing } = await session.supabase
    .from('homepage_sections')
    .select('key, content');
  const before = new Map((existing ?? []).map((r) => [r.key as string, JSON.stringify(r.content)]));

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

  // A slot with no stored row counts as changed: publishing is exactly what
  // turns a default into something someone chose, which is the moment worth
  // recording. A publish that moves nothing writes nothing — an append-only
  // log fills with re-saves otherwise.
  const changed = rows
    .filter((r) => before.get(r.key) !== JSON.stringify(r.content))
    .map((r) => SLOT_NAMES[r.key] ?? r.key);

  if (changed.length > 0) {
    const named =
      changed.length === 1
        ? changed[0]
        : `${changed.slice(0, -1).join(', ')} and ${changed[changed.length - 1]}`;
    await writeAuditLog(createServiceClient(), {
      actorId: session.userId,
      action: 'homepage_published',
      entityType: 'homepage',
      entityId: 'homepage',
      summary: `Changed ${named}. Live on the storefront immediately.`,
    });
  }

  return NextResponse.json({ ok: true, published_at: now });
}
