import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import {
  StatusBadge,
  PAYMENT_BADGE,
  FULFILMENT_BADGE,
  AWAITING_FULFILMENT,
  AWAITING_RETURN,
  returnBadge,
  type BadgeTone,
} from '@/components/admin/status-badge';
import { customerName } from './orders/order-fields';

/**
 * A02 Dashboard — Figma 126:555 (Desktop) / 126:309 (Tablet) / 126:76
 * (Mobile). Lives at /admin, which until now 404'd: the rail's first item
 * pointed at a page that did not exist, and A17's footer referred to an
 * escalation "on the dashboard" that had nowhere to be.
 *
 * All six §9.1 figures are real columns. One of them only became real with
 * migration 012: "PAID REVENUE TODAY · net of refunds" could not be computed
 * before `refunds` existed, because payment_status recorded that a refund had
 * happened and never how much.
 *
 * THAT FIGURE SUBTRACTS EVERY REFUND ISSUED TODAY, including refunds against
 * orders placed weeks ago, which is what "net of refunds" has to mean if the
 * number is to reconcile with the bank. It also means a quiet day with a
 * large refund shows a NEGATIVE figure. That is correct — money left — and
 * the sub-line says so, because a number nobody can explain is worse than a
 * number nobody likes.
 *
 * LOW STOCK IS COUNTED IN JAVASCRIPT, not in the query, for the reason A07
 * gives: `stock_quantity <= low_stock_threshold` compares two columns and
 * PostgREST has no syntax for that. The variants are fetched lowest-stock
 * first so the rows that matter arrive first; the cap is PostgREST's default
 * 1000, which this catalogue is nowhere near and which is noted rather than
 * assumed away.
 *
 * Omitted: "Export orders" from the top bar — no route, no format, the same
 * call A11, A03, A07 and A17 all make.
 */
const RECENT_ORDERS = 5;
const QUEUE_ROWS = 5;
const VARIANT_SCAN_CAP = 1000;

export default async function AdminDashboardPage() {
  const supabase = await createServerComponentClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const [
    todayOrders,
    awaiting,
    oldestAwaiting,
    recent,
    variants,
    openReturns,
    refundsToday,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_pence, payment_status, fulfilment_status')
      .gte('placed_at', todayIso),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('fulfilment_status', AWAITING_FULFILMENT as unknown as string[]),
    supabase
      .from('orders')
      .select('placed_at')
      .in('fulfilment_status', AWAITING_FULFILMENT as unknown as string[])
      .order('placed_at', { ascending: true })
      .limit(1),
    supabase
      .from('orders')
      .select('id, order_number, email, total_pence, payment_status, fulfilment_status, placed_at, delivery_address')
      .order('placed_at', { ascending: false })
      .limit(RECENT_ORDERS),
    supabase
      .from('product_variants')
      .select('id, sku, colour, size, stock_quantity, low_stock_threshold, is_active, product_id, products(name)')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true })
      .range(0, VARIANT_SCAN_CAP - 1),
    supabase
      .from('returns')
      .select('id, return_number, status, requested_at, orders!inner(order_number, email, delivery_address), return_items(quantity, order_items(unit_price_pence))')
      .in('status', AWAITING_RETURN as unknown as string[])
      .order('requested_at', { ascending: true })
      .limit(QUEUE_ROWS),
    supabase.from('refunds').select('amount_pence').gte('created_at', todayIso),
  ]);

  // Every one of these reads as an empty dashboard when it fails, which is
  // exactly the swallowed-error shape CLAUDE.md records — a dashboard
  // reporting zero orders because the database is unreachable is worse than
  // one that refuses to render.
  if (todayOrders.error) throw new Error(`Could not load today's orders: ${todayOrders.error.message}`);
  if (awaiting.error) throw new Error(`Could not count open orders: ${awaiting.error.message}`);
  if (oldestAwaiting.error) throw new Error(`Could not read the oldest open order: ${oldestAwaiting.error.message}`);
  if (recent.error) throw new Error(`Could not load recent orders: ${recent.error.message}`);
  if (variants.error) throw new Error(`Could not load inventory: ${variants.error.message}`);
  if (openReturns.error) throw new Error(`Could not load the returns queue: ${openReturns.error.message}`);
  if (refundsToday.error) throw new Error(`Could not load today's refunds: ${refundsToday.error.message}`);

  const { count: returnsToReview, error: returnsCountError } = await supabase
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .in('status', AWAITING_RETURN as unknown as string[]);
  if (returnsCountError) throw new Error(`Could not count open returns: ${returnsCountError.message}`);

  const today = todayOrders.data ?? [];
  const paidToday = today.filter((o) =>
    ['paid', 'partially_refunded', 'refunded'].includes(o.payment_status),
  );
  const toPackToday = today.filter((o) =>
    (AWAITING_FULFILMENT as unknown as string[]).includes(o.fulfilment_status),
  ).length;
  const grossToday = paidToday.reduce((n, o) => n + o.total_pence, 0);
  const refundedToday = (refundsToday.data ?? []).reduce((n, r) => n + r.amount_pence, 0);

  type Variant = {
    id: string;
    sku: string;
    colour: string;
    size: string;
    stock_quantity: number;
    low_stock_threshold: number;
    product_id: string;
    products: { name: string } | null;
  };
  const allVariants = (variants.data ?? []) as unknown as Variant[];
  const soldOut = allVariants.filter((v) => v.stock_quantity === 0);
  const low = allVariants.filter(
    (v) => v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold,
  );
  // Sold out first, then the lowest counts — the order someone would work in.
  const needsAttention = [...soldOut, ...low].slice(0, QUEUE_ROWS);

  type ReturnRow = {
    id: string;
    return_number: string;
    status: string;
    requested_at: string;
    orders: { order_number: string; email: string; delivery_address: unknown } | null;
    return_items: { quantity: number; order_items: { unit_price_pence: number } | null }[];
  };
  const returnRows = (openReturns.data ?? []) as unknown as ReturnRow[];

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {longToday()} · figures are for today unless stated
          </p>
        </div>
        <Link href="/admin/products/new" style={primaryButtonStyle}>
          Add a T-shirt
        </Link>
      </div>

      <div className="mc-admin-content">
        <div className="mc-dash-metrics">
          <Metric
            label="Orders today"
            value={String(today.length)}
            note={toPackToday === 0 ? 'Nothing waiting to pack' : `${toPackToday} still to pack`}
          />
          <Metric
            label="Paid revenue today"
            value={formatPence(grossToday - refundedToday)}
            note={
              refundedToday > 0
                ? `${formatPence(grossToday)} taken less ${formatPence(refundedToday)} refunded today, on any order`
                : 'Net of refunds — none issued today'
            }
          />
          <Metric
            label="Awaiting fulfilment"
            value={String(awaiting.count ?? 0)}
            note={oldestNote(oldestAwaiting.data?.[0]?.placed_at ?? null)}
          />
          <Metric
            label="Low-stock variants"
            value={String(low.length)}
            note="At or below their own threshold"
          />
          <Metric
            label="Sold-out variants"
            value={String(soldOut.length)}
            note="Still visible, not buyable"
          />
          <Metric
            label="Returns to review"
            value={String(returnsToReview ?? 0)}
            note={oldestReturnNote(returnRows)}
          />
        </div>

        <Panel heading="Recent orders" action={{ href: '/admin/orders', label: 'View all orders' }}>
          {(recent.data ?? []).length === 0 ? (
            <p style={mutedSmall}>
              No orders yet. They appear here the moment Stripe confirms a payment.
            </p>
          ) : (
            <>
              {/* Tablet and desktop: the six-column table (126:671). */}
              <table className="mc-orders-table">
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Total</Th>
                    <Th>Payment</Th>
                    <Th>Fulfilment</Th>
                    <Th>Placed</Th>
                  </tr>
                </thead>
                <tbody>
                  {(recent.data ?? []).map((o) => (
                    <tr key={o.id} style={{ borderTop: '1px solid var(--mc-border-default)' }}>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} style={numberLinkStyle}>
                          {o.order_number}
                        </Link>
                      </Td>
                      <Td>{customerName(o.delivery_address, o.email)}</Td>
                      <Td>{formatPence(o.total_pence)}</Td>
                      <Td>
                        <Badge map={PAYMENT_BADGE} value={o.payment_status} />
                      </Td>
                      <Td>
                        <Badge map={FULFILMENT_BADGE} value={o.fulfilment_status} />
                      </Td>
                      <Td muted>{shortDateTime(o.placed_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile: one card per order (126:180). */}
              <div className="mc-orders-records">
                {(recent.data ?? []).map((o) => (
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
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{ ...numberLinkStyle, fontSize: 15 }}>
                        {o.order_number}
                      </Link>
                      <span style={{ flex: '1 0 0', minWidth: 0, fontSize: 13, color: 'var(--mc-text-muted)' }}>
                        {customerName(o.delivery_address, o.email)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatPence(o.total_pence)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                      <Badge map={PAYMENT_BADGE} value={o.payment_status} />
                      <Badge map={FULFILMENT_BADGE} value={o.fulfilment_status} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0 }}>
                      Placed {shortDateTime(o.placed_at)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <div className="mc-dash-queues">
          <Panel heading="Needs restocking or hiding" action={{ href: '/admin/inventory', label: 'Inventory' }}>
            {needsAttention.length === 0 ? (
              <p style={mutedSmall}>
                Nothing at or below its threshold. Every active variant has stock.
              </p>
            ) : (
              needsAttention.map((v) => (
                <div
                  key={v.id}
                  style={{
                    borderTop: '1px solid var(--mc-border-default)',
                    padding: '11px 0',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
                      <Link href={`/admin/products/${v.product_id}/variants`} style={{ color: 'var(--mc-text-primary)' }}>
                        {v.products?.name ?? 'Unknown product'}
                      </Link>
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0 }}>
                      {v.colour} / {v.size} · {v.sku}
                    </p>
                  </div>
                  {v.stock_quantity === 0 ? (
                    <StatusBadge label="Sold out" tone="danger" />
                  ) : (
                    <StatusBadge label={`${v.stock_quantity} left`} tone="attention" />
                  )}
                </div>
              ))
            )}
          </Panel>

          <Panel heading="Returns awaiting review" action={{ href: '/admin/returns', label: 'Returns' }}>
            {returnRows.length === 0 ? (
              <p style={mutedSmall}>Nothing waiting. Requests appear here as customers raise them.</p>
            ) : (
              returnRows.map((r) => {
                const badge = returnBadge(r.status, r.requested_at);
                const value = (r.return_items ?? []).reduce(
                  (n, i) => n + i.quantity * (i.order_items?.unit_price_pence ?? 0),
                  0,
                );
                const units = (r.return_items ?? []).reduce((n, i) => n + i.quantity, 0);
                return (
                  <div
                    key={r.id}
                    style={{
                      borderTop: '1px solid var(--mc-border-default)',
                      padding: '11px 0',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: '1 0 0', minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                        <Link href={`/admin/returns/${r.id}`} style={{ color: 'var(--mc-text-primary)' }}>
                          {r.return_number}
                        </Link>
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0 }}>
                        {r.orders?.order_number ?? '—'} ·{' '}
                        {customerName(r.orders?.delivery_address, r.orders?.email ?? '')} · {units} item
                        {units === 1 ? '' : 's'} · {formatPence(value)}
                      </p>
                    </div>
                    <StatusBadge label={badge.label} tone={badge.tone} />
                  </div>
                );
              })
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxSizing: 'border-box',
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: 0,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0, lineHeight: '18px' }}>{note}</p>
    </div>
  );
}

function Panel({
  heading,
  action,
  children,
}: {
  heading: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: 'var(--mc-text-muted)',
            margin: 0,
          }}
        >
          {heading}
        </h2>
        {action && (
          <Link href={action.href} style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-text-primary)' }}>
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Badge({
  map,
  value,
}: {
  map: Record<string, { label: string; tone: BadgeTone }>;
  value: string;
}) {
  const entry = map[value] ?? { label: value, tone: 'neutral' as const };
  return <StatusBadge label={entry.label} tone={entry.tone} />;
}

/** "Friday 4 September 2026" — the design's subtitle (126:7268). */
function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function oldestNote(iso: string | null): string {
  if (!iso) return 'Nothing waiting';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'All placed today';
  return `Oldest is ${days} day${days === 1 ? '' : 's'} old`;
}

/** The design says "One waiting 3 days". The real queue may have none, so
 * this says what is actually true rather than reserving a sentence. */
function oldestReturnNote(rows: { requested_at: string }[]): string {
  if (rows.length === 0) return 'Nothing waiting';
  const days = Math.floor((Date.now() - new Date(rows[0].requested_at).getTime()) / 86_400_000);
  if (days <= 0) return 'Oldest came in today';
  return `Oldest waiting ${days} day${days === 1 ? '' : 's'}`;
}

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const numberLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--mc-text-primary)',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  textDecoration: 'none',
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
        padding: '12px 12px 12px 0',
        fontSize: 14,
        color: muted ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}
