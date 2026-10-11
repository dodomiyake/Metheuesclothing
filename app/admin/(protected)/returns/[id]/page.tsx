import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import { StatusBadge, returnBadge, RETURN_REASONS } from '@/components/admin/status-badge';
import { WideOnly } from '@/components/admin/wide-only';
import { customerName } from '../../orders/order-fields';
import { ReturnDecision, type DecisionItem } from './return-decision';

/**
 * A18 Return details — Figma 144:2278 (Desktop) / 144:2056 (Tablet). No
 * Mobile frame, so it sits behind WideOnly like every other consequential
 * admin screen. The columns split at 1440 with a 340px side column, the same
 * shape A13 uses.
 *
 * WHAT IS OMITTED, and why each one:
 *
 *  - "View customer". There is no customer page. Same call A12 made.
 *  - INTERNAL NOTE, for the same reason A12 omits its notes panel: there is
 *    no notes table in the schema at all. The refund's own note field is
 *    real and goes to the audit log, so the need is partly met where it
 *    actually has somewhere to go.
 *  - "Return postage — Free, drop-off". Nothing issues a label, charges for
 *    one, or records how the parcel travelled. `returns.label_expires_at`
 *    exists and is never written. The Progress list says so rather than
 *    drawing a "Label issued · valid until 24 September" step that would be
 *    blank forever.
 *
 * ELIGIBILITY IS COMPUTED THE WAY request_return COMPUTES IT — from
 * store_settings.return_window_days against max(delivered_at, shipped_at,
 * placed_at) — rather than from a second rule written for this screen. If
 * the two disagreed, staff would be told a return is eligible that the
 * database had already refused.
 */
export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: ret, error } = await supabase
    .from('returns')
    .select(
      'id, return_number, status, requested_at, received_at, decided_at, decision_reason, refund_pence, customer_note, order_id',
    )
    .eq('id', id)
    .maybeSingle();
  // A query error and an unknown id both leave `ret` null; only the second
  // is a 404 (CLAUDE.md's swallowed-error note).
  if (error) throw new Error(`Could not load the return: ${error.message}`);
  if (!ret) notFound();

  const [order, items, fulfilments, settings, refunds] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, email, total_pence, delivery_pence, delivery_address, placed_at')
      .eq('id', ret.order_id)
      .single(),
    supabase
      .from('return_items')
      .select(
        'id, quantity, reason, condition, restock, order_items(product_name, sku, colour, size, unit_price_pence)',
      )
      .eq('return_id', id),
    supabase
      .from('fulfilments')
      .select('shipped_at, delivered_at')
      .eq('order_id', ret.order_id)
      .order('shipped_at', { ascending: false }),
    supabase.from('store_settings').select('return_window_days').single(),
    supabase.from('refunds').select('amount_pence').eq('order_id', ret.order_id),
  ]);

  if (order.error) throw new Error(`Could not load the order: ${order.error.message}`);
  if (items.error) throw new Error(`Could not load the return's items: ${items.error.message}`);
  if (fulfilments.error) throw new Error(`Could not load fulfilments: ${fulfilments.error.message}`);
  if (settings.error) throw new Error(`Could not load store settings: ${settings.error.message}`);
  if (refunds.error) throw new Error(`Could not load refunds: ${refunds.error.message}`);

  const { count: priorReturns } = await supabase
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', ret.order_id);

  type Line = {
    id: string;
    quantity: number;
    reason: string;
    condition: string | null;
    restock: boolean;
    order_items: {
      product_name: string;
      sku: string;
      colour: string;
      size: string;
      unit_price_pence: number;
    } | null;
  };
  const lines = (items.data ?? []) as unknown as Line[];

  const decisionItems: DecisionItem[] = lines.map((l) => ({
    id: l.id,
    label: `${l.order_items?.product_name ?? 'Item'} — ${l.order_items?.colour ?? ''} / ${
      l.order_items?.size ?? ''
    }`,
    sku: l.order_items?.sku ?? '',
    quantity: l.quantity,
    linePence: l.quantity * (l.order_items?.unit_price_pence ?? 0),
    customerReason: RETURN_REASONS[l.reason] ?? l.reason,
    condition: l.condition,
    restock: l.restock,
  }));

  const itemsValue = decisionItems.reduce((n, i) => n + i.linePence, 0);
  const alreadyRefunded = (refunds.data ?? []).reduce((n, r) => n + r.amount_pence, 0);
  // Never offer more than the order has left, whatever the return is worth —
  // record_refund would refuse it anyway.
  const refundable = Math.max(0, Math.min(itemsValue, order.data.total_pence - alreadyRefunded));

  const windowDays = settings.data?.return_window_days ?? null;
  const windowFrom =
    fulfilments.data?.[0]?.delivered_at ?? fulfilments.data?.[0]?.shipped_at ?? order.data.placed_at;
  const windowCloses =
    windowDays && windowFrom
      ? new Date(new Date(windowFrom).getTime() + windowDays * 86_400_000)
      : null;
  const inWindow = windowCloses ? new Date(ret.requested_at) <= windowCloses : null;

  const badge = returnBadge(ret.status, ret.requested_at);
  const customer = customerName(order.data.delivery_address, order.data.email);

  return (
    <WideOnly title={`Return ${ret.return_number}`}>
      <div className="mc-admin-page">
        <div className="mc-admin-topbar">
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
              <Link href="/admin/returns" style={{ color: 'var(--mc-text-muted)' }}>
                ← Returns
              </Link>
            </p>
            <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
              Return {ret.return_number}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
              Order {order.data.order_number} · {customer} · requested {longDate(ret.requested_at)} ·{' '}
              {formatPence(itemsValue)}
            </p>
          </div>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </div>

        <div className="mc-admin-content">
          {/* The two columns live inside ReturnDecision because the design
              splits one piece of state across both: Items and condition is in
              the main column, the Approve button that applies it is in the
              side one. These panels are server-rendered and handed in. */}
          <ReturnDecision
            returnId={ret.id}
            returnNumber={ret.return_number}
            status={ret.status}
            items={decisionItems}
            refundablePence={refundable}
            alreadyRefundedPence={alreadyRefunded}
            deliveryPence={order.data.delivery_pence}
            eligibility={
              <Panel heading="Eligibility">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {inWindow !== null && (
                    <StatusBadge
                      label={inWindow ? 'Within the window' : 'Outside the window'}
                      tone={inWindow ? 'success' : 'danger'}
                    />
                  )}
                  <StatusBadge label={badge.label} tone={badge.tone} />
                </div>
                <p style={mutedSmall}>
                  {eligibilitySentence(
                    windowFrom,
                    windowCloses,
                    windowDays,
                    ret.requested_at,
                    Boolean(fulfilments.data?.[0]?.delivered_at),
                  )}
                </p>
              </Panel>
            }
            progress={
              <Panel heading="Progress">
                {progressSteps(ret, Boolean(fulfilments.data?.[0])).map((s) => (
                  <div key={s.label} style={{ display: 'flex', gap: 12, padding: '4px 0' }}>
                    <span
                      aria-hidden
                      style={{
                        width: s.state === 'current' ? 14 : 10,
                        height: s.state === 'current' ? 14 : 10,
                        marginTop: 5,
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: s.state === 'todo' ? 'transparent' : 'var(--mc-text-primary)',
                        border: s.state === 'todo' ? '1px solid var(--mc-border-control)' : 'none',
                      }}
                    />
                    <div style={{ flex: '1 0 0', minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          margin: 0,
                          fontWeight: s.state === 'current' ? 600 : 500,
                          color: s.state === 'todo' ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
                        }}
                      >
                        {s.label}
                      </p>
                      <p style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
                        {s.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </Panel>
            }
            customerNote={
              ret.customer_note ? (
                <Panel heading="What the customer wrote">
                  <p style={{ fontSize: 14, lineHeight: '20px', margin: 0 }}>
                    &ldquo;{ret.customer_note}&rdquo;
                  </p>
                </Panel>
              ) : null
            }
            customer={
              <>
                <Panel heading="Customer">
                  <Field label="Name" value={customer} />
                  <Field label="Email" value={order.data.email} />
                  <Field
                    label="This order"
                    value={`${formatPence(order.data.total_pence)}${
                      (priorReturns ?? 1) > 1 ? ` · ${(priorReturns ?? 1) - 1} other return on it` : ''
                    }`}
                  />
                  <p style={{ margin: 0 }}>
                    <Link href={`/admin/orders/${order.data.id}`} style={{ fontSize: 15, fontWeight: 600 }}>
                      Open order {order.data.order_number}
                    </Link>
                  </p>
                </Panel>
                {ret.decided_at && (
                  <Panel heading="Decision recorded">
                    <Field label="When" value={longDate(ret.decided_at)} />
                    {ret.decision_reason && <Field label="Reason" value={ret.decision_reason} />}
                    {ret.refund_pence ? (
                      <Field label="Refunded" value={formatPence(ret.refund_pence)} />
                    ) : null}
                  </Panel>
                )}
              </>
            }
          />
        </div>
      </div>
    </WideOnly>
  );
}

/** The same rule request_return() enforces, said in words. */
function eligibilitySentence(
  windowFrom: string | null,
  closes: Date | null,
  days: number | null,
  requestedAt: string,
  delivered: boolean,
): string {
  if (!days) {
    return 'store_settings has no return window configured, so eligibility cannot be judged here.';
  }
  if (!closes || !windowFrom) {
    return `The ${days}-day window is measured from delivery, and nothing has been dispatched on this order yet.`;
  }
  const from = delivered ? 'Delivered' : 'Dispatched';
  const spare = Math.round(
    (closes.getTime() - new Date(requestedAt).getTime()) / 86_400_000,
  );
  const base = `${from} ${longDate(windowFrom)}. The ${days}-day window closes on ${longDate(closes.toISOString())}`;
  if (spare >= 0) {
    return `${base}, so this request came in with ${spare} day${spare === 1 ? '' : 's'} to spare.`;
  }
  return `${base}, so this request came in ${Math.abs(spare)} day${
    Math.abs(spare) === 1 ? '' : 's'
  } late. request_return() should have refused it — worth checking before deciding.`;
}

type Step = { label: string; detail: string; state: 'done' | 'current' | 'todo' };

/** A18's progress list, derived. Two of the design's steps cannot be real:
 * nothing issues a label (returns.label_expires_at is never written), and
 * nothing records how the parcel travelled, so "Dropped off 11 September ·
 * Royal Mail" has no source. Both say so rather than showing a blank. */
function progressSteps(
  ret: {
    status: string;
    requested_at: string;
    received_at: string | null;
    decided_at: string | null;
    refund_pence: number | null;
  },
  _shipped: boolean,
): Step[] {
  const decided = ret.status === 'approved' || ret.status === 'rejected' || ret.status === 'refunded';
  return [
    { label: 'Requested by the customer', detail: longDateTime(ret.requested_at), state: 'done' },
    {
      label: 'On its way to us',
      detail:
        'Not tracked — no return label is issued and nothing records how the parcel travelled.',
      state: ret.received_at ? 'done' : 'todo',
    },
    {
      label: 'Received and checked',
      detail: ret.received_at ? longDateTime(ret.received_at) : 'Not yet — mark it received when it arrives',
      state: ret.received_at ? 'done' : 'current',
    },
    {
      label: ret.status === 'rejected' ? 'Rejected' : 'Approved',
      detail: decided
        ? longDateTime(ret.decided_at ?? ret.requested_at)
        : 'Not yet — approving records the condition and puts stock back',
      state: decided ? 'done' : ret.received_at ? 'current' : 'todo',
    },
    {
      label: 'Refunded',
      detail:
        ret.status === 'refunded'
          ? `${formatPence(ret.refund_pence ?? 0)} sent`
          : ret.status === 'rejected'
            ? 'Not refunded — the return was rejected'
            : 'Only after the check',
      state: ret.status === 'refunded' ? 'done' : ret.status === 'approved' ? 'current' : 'todo',
    },
  ];
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function longDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function Panel({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
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
        {heading}
      </h2>
      <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};
