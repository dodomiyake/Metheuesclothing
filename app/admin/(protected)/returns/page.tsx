import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import { StatusBadge, returnBadge, AWAITING_RETURN } from '@/components/admin/status-badge';
import { customerName } from '../orders/order-fields';
import { ReturnsToolbar } from './returns-toolbar';

const PAGE_SIZE = 25;

/**
 * A17 Returns — Figma 143:2093 (Desktop) / 143:1924 (Tablet) / 143:1783
 * (Mobile). Structurally A11: the seven-column table swaps for a record
 * list at 768 while the rail swaps at 1440, so TABLET IS NOT MOBILE here
 * either — confirmed by pulling the mobile frame rather than assuming it
 * repeats A11's.
 *
 * THE SORT IS THE SCREEN'S ONE REAL IDEA and it is not newest-first.
 * "Oldest first when something is waiting on you." Anything in requested,
 * received or approved is work; everything else is history. So this runs two
 * ordered queries — open ascending, closed descending — and pages across the
 * concatenation. One query cannot express it: Postgres can order by a
 * CASE, but PostgREST has no way to ask for one, and sorting a single page
 * in JavaScript would only sort the rows that page happened to contain.
 *
 * VALUE is computed, not stored. `returns.refund_pence` is nullable and is
 * only written when a refund is decided, so using it would leave the column
 * blank for exactly the rows someone is looking at. It is the sum of
 * order_items.unit_price_pence × return_items.quantity — what the customer
 * is asking for back, which is the number you need before deciding.
 *
 * Two things in the design are not reproduced:
 *
 *  - "Export returns", for the same reason A11 omits "Export orders": no
 *    route and no format. A disabled button plus an explanation of why it
 *    is disabled is worse than no button.
 *
 *  - The footer's "A request left unanswered for 5 days is escalated on the
 *    dashboard." There is no dashboard (A02 is unbuilt) and nothing
 *    escalates anything. The sort rule above it is real and is kept; the
 *    escalation is a promise the system does not keep, so it says what
 *    actually happens instead. The Age filter is what makes the 5-day rule
 *    usable today.
 */
type ReturnRow = {
  id: string;
  return_number: string;
  status: string;
  requested_at: string;
  order_id: string;
  orders: { order_number: string; email: string; delivery_address: unknown } | null;
  return_items: { quantity: number; reason: string; order_items: { unit_price_pence: number } | null }[];
};

const SELECT =
  'id, return_number, status, requested_at, order_id, orders!inner(order_number, email, delivery_address), return_items(quantity, reason, order_items(unit_price_pence))';

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const q = one('q').trim();
  const status = one('status');
  const reason = one('reason');
  const age = one('age');
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);

  const supabase = await createServerComponentClient();

  const open = AWAITING_RETURN as unknown as string[];

  // SEARCH RESOLVES THROUGH ORDERS FIRST. The design's placeholder promises
  // "return, order or customer", but order number, email and the customer's
  // name all live on `orders` (the last inside the Stripe jsonb snapshot),
  // not on `returns`. PostgREST can OR across an embedded resource, but
  // nothing in this codebase has ever run that construct against a real
  // database and this is not the place to find out. Two queries of shapes
  // A11 already uses do the same job: find the matching orders, then match
  // returns on their ids or on the return number itself.
  let matchedOrderIds: string[] | null = null;
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    const { data: matches, error: matchError } = await supabase
      .from('orders')
      .select('id')
      .or(`order_number.ilike.%${safe}%,email.ilike.%${safe}%,delivery_address->>name.ilike.%${safe}%`);
    if (matchError) throw new Error(`Could not search orders: ${matchError.message}`);
    matchedOrderIds = (matches ?? []).map((o) => o.id as string);
  }

  const select = reason ? SELECT.replace('return_items(', 'return_items!inner(') : SELECT;

  const build = (half: 'open' | 'closed') => {
    let b = supabase.from('returns').select(select, { count: 'exact' });
    b = half === 'open' ? b.in('status', open) : b.not('status', 'in', `(${open.join(',')})`);
    if (status) b = b.eq('status', status);
    if (age) {
      b = b.lte('requested_at', new Date(Date.now() - Number(age) * 86_400_000).toISOString());
    }
    // A reason belongs to the return's ITEMS, so !inner above turns the
    // embed into a join and this filters the return rows themselves.
    if (reason) b = b.eq('return_items.reason', reason);
    if (q) {
      const safe = q.replace(/[%,()]/g, ' ');
      const ids = matchedOrderIds ?? [];
      b = ids.length
        ? b.or(`return_number.ilike.%${safe}%,order_id.in.(${ids.join(',')})`)
        : b.ilike('return_number', `%${safe}%`);
    }
    return b.order('requested_at', { ascending: half === 'open' });
  };

  const openQuery = build('open');
  const closedQuery = build('closed');

  const from = (page - 1) * PAGE_SIZE;

  const [openHead, closedHead] = await Promise.all([
    openQuery.range(from, from + PAGE_SIZE - 1),
    closedQuery.range(0, PAGE_SIZE - 1),
  ]);
  // A query error and an empty queue both leave `data` null; only the second
  // is "no returns" (CLAUDE.md's swallowed-error note).
  if (openHead.error) throw new Error(`Could not load open returns: ${openHead.error.message}`);
  if (closedHead.error) throw new Error(`Could not load closed returns: ${closedHead.error.message}`);

  const openCount = openHead.count ?? 0;
  const closedCount = closedHead.count ?? 0;
  const total = openCount + closedCount;

  let rows: ReturnRow[];
  if (from >= openCount) {
    // Past the open half entirely — page into the closed half directly.
    const offset = from - openCount;
    const { data, error } = await build('closed').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load returns: ${error.message}`);
    rows = (data ?? []) as unknown as ReturnRow[];
  } else {
    const openRows = (openHead.data ?? []) as unknown as ReturnRow[];
    const spare = PAGE_SIZE - openRows.length;
    rows = openRows;
    if (spare > 0) {
      const { data, error } = await build('closed').range(0, spare - 1);
      if (error) throw new Error(`Could not load returns: ${error.message}`);
      rows = [...openRows, ...((data ?? []) as unknown as ReturnRow[])];
    }
  }

  const { count: awaiting, error: awaitingError } = await supabase
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .in('status', open);
  if (awaitingError) throw new Error(`Could not count open returns: ${awaitingError.message}`);

  const { count: inTransit, error: transitError } = await supabase
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .in('status', ['label_issued', 'in_transit']);
  if (transitError) throw new Error(`Could not count parcels in transit: ${transitError.message}`);

  const filtered = Boolean(q || status || reason || age);

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Returns
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {subtitle(awaiting ?? 0, inTransit ?? 0)}
          </p>
        </div>
      </div>

      <div className="mc-admin-content">
        <ReturnsToolbar q={q} status={status} reason={reason} age={age} />

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
          {rows.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--mc-text-muted)', margin: 0 }}>
              {filtered
                ? 'No returns match these filters.'
                : 'No returns yet. They appear here when a customer requests one from their order.'}
            </p>
          ) : (
            <>
              {/* Tablet and desktop: the seven-column table (143:2195). */}
              <table className="mc-orders-table">
                <thead>
                  <tr>
                    <Th>Return</Th>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Items</Th>
                    <Th>Value</Th>
                    <Th>Requested</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const badge = returnBadge(r.status, r.requested_at);
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--mc-border-default)' }}>
                        <Td>
                          <Link href={`/admin/returns/${r.id}`} style={numberLinkStyle}>
                            {r.return_number}
                          </Link>
                        </Td>
                        <Td>
                          <Link href={`/admin/orders/${r.order_id}`} style={{ color: 'var(--mc-text-primary)' }}>
                            {r.orders?.order_number ?? '—'}
                          </Link>
                        </Td>
                        <Td>{customerName(r.orders?.delivery_address, r.orders?.email ?? '')}</Td>
                        <Td>{unitCount(r)}</Td>
                        <Td>{formatPence(valuePence(r))}</Td>
                        <Td muted>{formatRequested(r.requested_at)}</Td>
                        <Td>
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile: one record per return (143:1872) — number, a single
                  meta line, then the badge. */}
              <div className="mc-orders-records">
                {rows.map((r) => {
                  const badge = returnBadge(r.status, r.requested_at);
                  return (
                    <div
                      key={r.id}
                      style={{
                        borderTop: '1px solid var(--mc-border-default)',
                        padding: '14px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <Link href={`/admin/returns/${r.id}`} style={{ ...numberLinkStyle, fontSize: 15 }}>
                        {r.return_number}
                      </Link>
                      <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
                        Order: {r.orders?.order_number ?? '—'} · Customer:{' '}
                        {customerName(r.orders?.delivery_address, r.orders?.email ?? '')} · Items:{' '}
                        {unitCount(r)} · Value: {formatPence(valuePence(r))} · Requested:{' '}
                        {formatRequested(r.requested_at)}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                        <StatusBadge label={badge.label} tone={badge.tone} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="mc-admin-table-footer">
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            Oldest first while something is waiting on you, then most recent. Nothing escalates
            automatically yet — use the Age filter to find what has been sitting.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <PageLink params={params} page={page - 1} disabled={page === 1}>
              Previous
            </PageLink>
            <PageLink params={params} page={page + 1} disabled={from + rows.length >= total}>
              Next
            </PageLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Units asked for, not lines: returning 2 of the same T-shirt is 2 items on
 * the shelf, which is what the design's ITEMS column counts. */
function unitCount(r: ReturnRow): number {
  return (r.return_items ?? []).reduce((n, i) => n + i.quantity, 0);
}

/** What the customer is asking back, from the frozen order-line price. */
function valuePence(r: ReturnRow): number {
  return (r.return_items ?? []).reduce(
    (n, i) => n + i.quantity * (i.order_items?.unit_price_pence ?? 0),
    0,
  );
}

/** "7 Sept" — the design's format (143:2210). */
function formatRequested(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function subtitle(awaiting: number, inTransit: number): string {
  const parts: string[] = [];
  parts.push(awaiting === 0 ? 'Nothing waiting on you' : `${awaiting} waiting on you`);
  if (inTransit > 0) {
    parts.push(`${inTransit} parcel${inTransit === 1 ? '' : 's'} on the way back`);
  }
  return parts.join(' · ');
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
    // Ghost/Disabled (9:18). Not a link at all, so it cannot be tabbed to or
    // followed.
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
    <Link href={qs ? `/admin/returns?${qs}` : '/admin/returns'} style={{ ...base, color: 'var(--mc-text-primary)' }}>
      {children}
    </Link>
  );
}

const numberLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--mc-text-primary)',
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '10px 12px 10px 0',
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
        color: 'var(--mc-text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: '13px 12px 13px 0',
        fontSize: 14,
        color: muted ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}
