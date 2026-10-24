import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One place to write an audit row from a route handler.
 *
 * Most audited actions here live inside a Postgres function — adjust_stock,
 * advance_fulfilment, ship_order, cancel_order, record_refund,
 * decide_return — because the audit row and the thing it describes are one
 * write and rule 4 says so. This is for the ones that are not: a plain
 * PostgREST update that the spec nonetheless requires audited, where there
 * is no function to put the insert inside.
 *
 * It needs the SERVICE client. 002_rls.sql:149 revokes INSERT on audit_logs
 * from `authenticated`, deliberately — "an append-only log the actor writes
 * directly is not append-only in any useful sense" — so the caller's own
 * session cannot write here, and requireStaffSession() is what stands in
 * for the RLS check.
 *
 * actor_label is resolved from `profiles` rather than passed in, the same
 * choice migration 015 made for adjust_stock: a label the caller supplies
 * can disagree with the profile it names.
 */
export async function writeAuditLog(
  db: SupabaseClient,
  entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
  },
): Promise<void> {
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', entry.actorId)
    .single();

  await db.from('audit_logs').insert({
    actor_id: entry.actorId,
    actor_label: profile?.full_name || profile?.email || 'Staff',
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    summary: entry.summary,
  });
}
