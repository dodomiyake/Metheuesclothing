import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import {
  StatusBadge,
  PAYMENT_BADGE,
  FULFILMENT_BADGE,
  AWAITING_FULFILMENT,
} from '@/components/admin/status-badge';
import { OrdersToolbar } from './orders-toolbar';
import { countryName, customerName, orderCountryCode } from './order-fields';

const PAGE_SIZE = 25;

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  total_pence: number;
  payment_status: string;
  fulfilment_status: string;
  placed_at: string;
  delivery_address: unknown;
};

/**
 * A11 Orders — Figma 128:1827 (Desktop) / 128:1606 (Tablet) / 128:1421
 * (Mobile), all three pulled. The structural fact worth having pulled rather
 * than inferred: TABLET IS NOT MOBILE. It takes the stacked top bar from
 * mobile but keeps the full seven-column table from desktop, so the record
 * list and the table swap at 768px while the rail swaps at 1440px. Inferring
 * "tablet is a narrow mobile" would have produced card rows on a 768px
 * screen that has room for the whole table.
 *
 * Omitted, not faked: "Export orders" and "Print pick list". Both are drawn
 * in the top bar at every breakpoint and neither has a route, a file format
 * or a pick-list definition anywhere in this codebase. The Button component's
 * own description says a disabled button must carry text saying what would
 * enable it; two disabled buttons plus two explanations is worse than
 * nothing, so they are left out until there is something to export. Same
 * call as shop's "Design style" filter and the PDP's Estimate/Carrier rows.
 *
 * The filters ARE real: Payment and Fulfilment read their enum columns,
 * Date reads placed_at, and Country reads the ISO code Stripe writes into
 * delivery_address. Country options are derived from the orders that exist
 * rather than hardcoded, so the dropdown can never offer a country nothing
 * shipped to.
 */
export default async function AdminOrdersPage({
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
  const payment = one('payment');
  const fulfilment = one('fulfilment');
  const country = one('country');
  const days = one('days');
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);

  const supabase = await createServerComponentClient();

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, email, total_pence, payment_status, fulfilment_status, placed_at, delivery_address',
      { count: 'exact' },
    )
    .order('placed_at', { ascending: false });

  if (payment) query = query.eq('payment_status', payment);
  if (fulfilment) query = query.eq('fulfilment_status', fulfilment);
  if (days) {
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('placed_at', since);
  }
  if (country) query = query.eq('delivery_address->address->>country', country);
  if (q) {
    // Customer name lives inside the Stripe shipping snapshot, so it is
    // matched through the jsonb path rather than a column.
    const safe = q.replace(/[%,()]/g, ' ');
    query = query.or(
      `order_number.ilike.%${safe}%,email.ilike.%${safe}%,delivery_address->>name.ilike.%${safe}%`,
    );
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: orders, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  // A query error and an empty result both leave `orders` null; only the
  // second is "no orders". See CLAUDE.md's note on swallowed query errors.
  if (error) throw new Error(`Could not load orders: ${error.message}`);

  // The top-bar subtitle and the rail count come from the same real figures.
  const { count: awaitingCount, error: awaitingError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('fulfilment_status', AWAITING_FULFILMENT as unknown as string[]);
  if (awaitingError) throw new Error(`Could not count open orders: ${awaitingError.message}`);

  const { data: oldestRows, error: oldestError } = await supabase
    .from('orders')
    .select('placed_at')
    .in('fulfilment_status', AWAITING_FULFILMENT as unknown as string[])
    .order('placed_at', { ascending: true })
    .limit(1);
  if (oldestError) throw new Error(`Could not read the oldest open order: ${oldestError.message}`);

  const { data: countryRows, error: countryError } = await supabase
    .from('orders')
    .select('delivery_address');
  if (countryError) throw new Error(`Could not load countries: ${countryError.message}`);
  const countryCodes = [
    ...new Set((countryRows ?? []).map((r) => orderCountryCode(r.delivery_address)).filter(Boolean)),
  ].sort() as string[];

  const total = count ?? 0;
  const rows = (orders ?? []) as OrderRow[];
  const subtitle = buildSubtitle(awaitingCount ?? 0, oldestRows?.[0]?.placed_at ?? null);

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, color: 'var(--mc-text-primary)', margin: 0 }}>
            Orders
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>{subtitle}</p>
        </div>
      </div>

      <div className="mc-admin-content">
        <OrdersToolbar
          q={q}
          payment={payment}
          fulfilment={fulfilment}
          country={country}
          days={days}
          countryCodes={countryCodes}
        />

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
              {total === 0 && !q && !payment && !fulfilment && !country && !days
                ? 'No orders yet. They appear here the moment Stripe confirms a payment.'
                : 'No orders match these filters.'}
            </p>
          ) : (
            <>
              {/* Tablet and desktop: the seven-column table (128:1700). */}
              <table className="mc-orders-table">
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Placed</Th>
                    <Th>Customer</Th>
                    <Th>Total</Th>
                    <Th>Payment</Th>
                    <Th>Fulfilment</Th>
                    <Th>Country</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} style={{ borderTop: '1px solid var(--mc-border-default)' }}>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} style={orderLinkStyle}>
                          {o.order_number}
                        </Link>
                      </Td>
                      <Td muted>{formatPlaced(o.placed_at)}</Td>
                      <Td>{customerName(o.delivery_address, o.email)}</Td>
                      <Td>{formatPence(o.total_pence)}</Td>
                      <Td>
                        <Badge map={PAYMENT_BADGE} value={o.payment_status} />
                      </Td>
                      <Td>
                        <Badge map={FULFILMENT_BADGE} value={o.fulfilment_status} />
                      </Td>
                      <Td muted>{countryName(orderCountryCode(o.delivery_address))}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile: one record per order (128:1515) — number, a single
                  meta line, then the badges. */}
              <div className="mc-orders-records">
                {rows.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      borderTop: '1px solid var(--mc-border-default)',
                      padding: '14px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <Link href={`/admin/orders/${o.id}`} style={{ ...orderLinkStyle, fontSize: 15 }}>
                      {o.order_number}
                    </Link>
                    <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
                      Placed: {formatPlaced(o.placed_at)} · Customer:{' '}
                      {customerName(o.delivery_address, o.email)} · Total: {formatPence(o.total_pence)} ·
                      Country: {countryName(orderCountryCode(o.delivery_address))}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                      <Badge map={PAYMENT_BADGE} value={o.payment_status} />
                      <Badge map={FULFILMENT_BADGE} value={o.fulfilment_status} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mc-admin-table-footer">
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            {total === 0
              ? 'No orders'
              : `Showing ${from + 1}–${Math.min(from + rows.length, total)} of ${total} order${total === 1 ? '' : 's'}`}
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

function Badge({
  map,
  value,
}: {
  map: Record<string, { label: string; tone: 'success' | 'attention' | 'danger' | 'neutral' | 'info' }>;
  value: string;
}) {
  // An unmapped enum value renders its raw name rather than nothing: a new
  // status added to the schema should look unfinished here, not invisible.
  const entry = map[value] ?? { label: value, tone: 'neutral' as const };
  return <StatusBadge label={entry.label} tone={entry.tone} />;
}

/** "4 Sept, 18:42" — the design's format (128:1710). */
function formatPlaced(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function buildSubtitle(awaiting: number, oldestIso: string | null): string {
  if (awaiting === 0) return 'Nothing awaiting fulfilment';
  const head = `${awaiting} awaiting fulfilment`;
  if (!oldestIso) return head;
  const days = Math.floor((Date.now() - new Date(oldestIso).getTime()) / 86_400_000);
  const age = days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  return `${head} · oldest placed ${age}`;
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
    // followed — a greyed anchor that still navigates is a worse dead end
    // than no control.
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
    <Link href={qs ? `/admin/orders?${qs}` : '/admin/orders'} style={{ ...base, color: 'var(--mc-text-primary)' }}>
      {children}
    </Link>
  );
}

const orderLinkStyle: React.CSSProperties = {
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
