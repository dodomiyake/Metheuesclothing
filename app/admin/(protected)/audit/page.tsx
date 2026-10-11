import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { StatusBadge, AUDIT_BADGE } from '@/components/admin/status-badge';
import { AuditToolbar } from './audit-toolbar';

const PAGE_SIZE = 50;
const DEFAULT_DAYS = 30;

/**
 * A23 Audit log — Figma 146:3635 (Desktop) / 146:3454 (Tablet).
 *
 * IT HAS NO MOBILE FRAME, and that is worth recording because it is a
 * counterexample to the rationale written into components/admin/wide-only:
 * the split there was read-vs-write, and this is a read screen. It is NOT
 * gated behind WideOnly anyway — every entry is a stacking block of text,
 * so there is no table to squash, and refusing to show an append-only log
 * on a phone would be withholding the one screen you reach for when
 * something has gone wrong away from a desk. One more reason to settle that
 * rationale with the design owner rather than treating it as a rule.
 *
 * THE DESIGN DRAWS EIGHT EVENT TYPES AND THIS SYSTEM WRITES FOUR AND A HALF.
 * §9.6 lists refund, stock adjustment, return, content publish, dispatch,
 * archive, price change and sign-in. Recorded today: refunds (012),
 * dispatch (011), return decisions (014), and stock adjustments — the last
 * only as of 015, which exists because this project twice shipped a claim
 * that stock changes were audited and twice had to retract it. Partial:
 * a return's PROGRESS is logged but the customer first raising one is not,
 * because request_return() writes no audit row. Missing entirely: content
 * publish, archive, price change and sign-in. The panel at the foot of the
 * screen says so by name. A log that looks complete and is not is worse
 * than a short one, and this is the screen where that matters most.
 *
 * Omitted: "Export log" — no route, no format, the same call A11, A03, A07,
 * A17 and A02 all make. Here it carries extra weight, since an export of a
 * log that only covers half the required events would be evidence of the
 * wrong thing.
 */
type Entry = {
  id: number;
  actor_label: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const who = one('who');
  const what = one('what');
  const when = one('when');
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);

  const supabase = await createServerComponentClient();

  const days = when === 'all' ? null : Number.parseInt(when || String(DEFAULT_DAYS), 10);
  const since =
    days && Number.isFinite(days)
      ? new Date(Date.now() - days * 86_400_000).toISOString()
      : null;

  let query = supabase
    .from('audit_logs')
    .select('id, actor_label, action, entity_type, entity_id, summary, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false });

  if (who) query = query.eq('actor_label', who);
  if (what) query = query.eq('action', what);
  if (since) query = query.gte('created_at', since);

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  // An empty log and an unreachable database look identical in `data` —
  // CLAUDE.md's swallowed-error note. On this screen the difference matters
  // more than most: "nothing has happened" is a claim about the business.
  if (error) throw new Error(`Could not load the audit log: ${error.message}`);

  const entries = (data ?? []) as Entry[];

  // The actor list comes from the log itself, not from `profiles`: 'System'
  // has no profile, and a staff member who has done nothing auditable is
  // not a useful filter.
  const { data: actorRows, error: actorError } = await supabase
    .from('audit_logs')
    .select('actor_label')
    .order('created_at', { ascending: false })
    .limit(500);
  if (actorError) throw new Error(`Could not load actors: ${actorError.message}`);
  const actors = [...new Set((actorRows ?? []).map((r) => r.actor_label as string))].sort();

  // audit_logs stores an entity id and nothing else, so a row reads
  // "e5f1...-..." without this. Two batched lookups turn the ids on THIS
  // page into the numbers staff actually recognise.
  const orderIds = entries.filter((e) => e.entity_type === 'order' && e.entity_id).map((e) => e.entity_id!);
  const returnIds = entries.filter((e) => e.entity_type === 'return' && e.entity_id).map((e) => e.entity_id!);

  const [orderLabels, returnLabels] = await Promise.all([
    orderIds.length
      ? supabase.from('orders').select('id, order_number').in('id', orderIds)
      : Promise.resolve({ data: [] as { id: string; order_number: string }[], error: null }),
    returnIds.length
      ? supabase.from('returns').select('id, return_number').in('id', returnIds)
      : Promise.resolve({ data: [] as { id: string; return_number: string }[], error: null }),
  ]);
  if (orderLabels.error) throw new Error(`Could not resolve order numbers: ${orderLabels.error.message}`);
  if (returnLabels.error) throw new Error(`Could not resolve return numbers: ${returnLabels.error.message}`);

  const labelById = new Map<string, { label: string; href: string }>();
  for (const o of orderLabels.data ?? []) {
    labelById.set(o.id as string, { label: o.order_number as string, href: `/admin/orders/${o.id}` });
  }
  for (const r of returnLabels.data ?? []) {
    labelById.set(r.id as string, { label: r.return_number as string, href: `/admin/returns/${r.id}` });
  }

  const total = count ?? 0;
  const filtered = Boolean(who || what || when);

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Audit log
          </h1>
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            Every refund, dispatch, return decision and stock change, with the person who did it.
            Entries cannot be edited or deleted.
          </p>
        </div>
      </div>

      <div className="mc-admin-content">
        <AuditToolbar who={who} what={what} when={when} actors={actors} />

        <div
          style={{
            background: 'var(--mc-bg-surface)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 'var(--mc-radius-md)',
            padding: 18,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {entries.length === 0 ? (
            <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
              {filtered
                ? 'Nothing matches these filters. The default window is the last 30 days — widen it with “When”.'
                : 'Nothing recorded yet. Entries appear as staff refund, dispatch, decide returns and adjust stock.'}
            </p>
          ) : (
            entries.map((e, i) => {
              const badge = AUDIT_BADGE[e.action] ?? { label: e.action, tone: 'neutral' as const };
              const entity = e.entity_id ? labelById.get(e.entity_id) : undefined;
              return (
                <div
                  key={e.id}
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--mc-border-default)',
                    padding: '14px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '6px 10px',
                    }}
                  >
                    <StatusBadge label={badge.label} tone={badge.tone} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {entity ? (
                        <Link href={entity.href} style={{ color: 'var(--mc-text-primary)' }}>
                          {entity.label}
                        </Link>
                      ) : (
                        entityFallback(e)
                      )}
                    </span>
                    <span style={{ flex: '1 0 0', minWidth: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--mc-text-muted)', whiteSpace: 'nowrap' }}>
                      {e.actor_label} · {shortDateTime(e.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
                    {e.summary}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <section
          style={{
            background: 'var(--mc-bg-page)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 'var(--mc-radius-md)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxSizing: 'border-box',
          }}
        >
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: 'var(--mc-text-muted)',
              margin: 0,
            }}
          >
            What this log is for, and what it does not yet cover
          </h2>
          <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />
          <p style={note}>
            It answers &ldquo;who changed this, and when&rdquo; without anyone having to remember.
            Entries are append-only — nobody, including the owner, can edit or remove one. That is
            enforced by the forbid_audit_mutation triggers, not by convention.
          </p>
          {/* §9.6 names eight auditable events. Saying which four are
              missing is the most useful thing this screen can do: a log
              that looks complete and is not is worse than a short one. */}
          <p style={note}>
            Recorded today: refunds and cancellations, dispatch, return decisions, and manual stock
            changes. NOT yet recorded: a customer raising a return, publishing homepage content,
            archiving a product, changing a price, and signing in. Those five write nothing here, so
            their absence from the list above means nothing happened to record — not that nothing
            happened.
          </p>
          <p style={note}>
            Nothing deletes entries, so the log only grows. The six-year retention §9.6 asks for is a
            policy, not something this system enforces in either direction yet.
          </p>
        </section>

        <div className="mc-admin-table-footer">
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            {total === 0
              ? 'No entries'
              : `Showing ${from + 1}–${Math.min(from + entries.length, total)} of ${total}`}
            {when === 'all' ? '' : ` in the last ${days} days`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <PageLink params={params} page={page - 1} disabled={page === 1}>
              Previous
            </PageLink>
            <PageLink params={params} page={page + 1} disabled={from + entries.length >= total}>
              Next
            </PageLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A variant has no page of its own and a deleted order leaves its id
 * behind — append-only means an entry outlives what it describes, which is
 * the point. Say what the entry was about rather than printing a uuid. */
function entityFallback(e: Entry): string {
  if (e.entity_type === 'variant') return 'Variant';
  if (!e.entity_id) return e.entity_type;
  return `${e.entity_type} (no longer in the catalogue)`;
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: '14px 24px',
    borderRadius: 'var(--mc-radius-sm)',
    fontFamily: 'var(--mc-font-body)',
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: '0.32px',
    textDecoration: 'none',
  };

  if (disabled) {
    return (
      <span aria-disabled style={{ ...base, color: 'var(--mc-text-muted)' }}>
        {children}
      </span>
    );
  }

  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page') continue;
    const s = Array.isArray(v) ? v[0] : v;
    if (s) next.set(k, s);
  }
  if (page > 1) next.set('page', String(page));
  const qs = next.toString();
  return (
    <Link href={qs ? `/admin/audit?${qs}` : '/admin/audit'} style={{ ...base, color: 'var(--mc-text-primary)' }}>
      {children}
    </Link>
  );
}

const note: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};
