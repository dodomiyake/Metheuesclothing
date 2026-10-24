import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { UpdateProductRequest } from '@/lib/admin/product-schema';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/admin/audit';

export const runtime = 'nodejs';

/**
 * §9.6 is explicit that "product archive ... require[s] explicit
 * confirmation and audit logging", and until now a product was archived by
 * picking one option out of a status select and pressing Save, with nothing
 * written anywhere. Both halves are closed: the confirmation is in A04's
 * form, and the audit row is written here.
 *
 * It covers every status TRANSITION, not only archiving. The write is the
 * same one either way, and "who unpublished this and when" is the question
 * a staff member asks about a T-shirt that has vanished from the shop —
 * which is also the design's "content publish" event in A23's panel. A save
 * that leaves the status where it was writes nothing: the log records
 * changes, and a row per re-save would bury the four that matter.
 */
const STATUS_EVENT: Record<string, { action: string; verb: string }> = {
  draft: { action: 'product_unpublished', verb: 'moved back to draft' },
  scheduled: { action: 'product_scheduled', verb: 'marked scheduled' },
  published: { action: 'product_published', verb: 'published' },
  archived: { action: 'product_archived', verb: 'archived' },
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = UpdateProductRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { ...parsed.data };
  let transition: { from: string; to: string; name: string } | null = null;

  if (parsed.data.status) {
    // published_at/archived_at are set once, on the transition into that
    // status, not on every subsequent edit -- otherwise re-saving a
    // published product would keep pushing its publish date forward.
    const { data: current } = await session.supabase
      .from('products')
      .select('status, published_at, archived_at, name')
      .eq('id', id)
      .single();

    if (parsed.data.status === 'published' && !current?.published_at) {
      patch.published_at = new Date().toISOString();
    }
    if (parsed.data.status === 'archived' && !current?.archived_at) {
      patch.archived_at = new Date().toISOString();
    }

    if (current && current.status !== parsed.data.status) {
      // The name is read BEFORE the update, so an edit that renames and
      // archives in one save still logs the name staff will be looking for.
      transition = { from: current.status, to: parsed.data.status, name: current.name };
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

  // After the update, never before. An append-only log cannot retract an
  // entry, so a row describing a change that then failed would be a lie
  // nobody can correct — the same ordering cancel_order and record_refund
  // use inside their own functions.
  if (transition) {
    const event = STATUS_EVENT[transition.to];
    if (event) {
      await writeAuditLog(createServiceClient(), {
        actorId: session.userId,
        action: event.action,
        entityType: 'product',
        entityId: data.id,
        summary: `"${transition.name}" ${event.verb} (was ${transition.from}).`,
      });
    }
  }

  return NextResponse.json({ id: data.id });
}
