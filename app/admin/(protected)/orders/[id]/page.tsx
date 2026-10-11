import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import { StatusBadge, PAYMENT_BADGE, FULFILMENT_BADGE } from '@/components/admin/status-badge';
import { countryName, customerName, orderCountryCode } from '../order-fields';
import { buildFulfilmentSteps } from './fulfilment-steps';
import { AddTracking } from './add-tracking';
import { CancelOrder } from './cancel-order';
import { RefundOrder } from './refund-order';

/**
 * A12 Order details — Figma 139:1861 (Desktop) / 139:1620 (Tablet) /
 * 139:1379 (Mobile), all three pulled. The two columns split at 1440 ONLY:
 * tablet and mobile stack Order main above Order side in the same order, so
 * unlike A11 this screen has one breakpoint, not two.
 *
 * This is a READ screen, deliberately. The design hangs eight actions off it
 * — Begin packing, Add tracking, Print packing slip, View customer, Open in
 * Stripe, Add note, Cancel order, Refund — and exactly one of them has
 * anywhere to go today (Open in Stripe, because payments.stripe_payment_
 * intent_id is really written). A13 Fulfilment, A14 Add tracking, A15 Cancel
 * and A16 Refund are separate screens that do not exist, and the routes
 * behind them do not either. Buttons that look live and do nothing are worse
 * than no buttons, so they are omitted until the screen behind each one
 * lands — the same call A11 made for Export orders.
 *
 * Four things in the design are omitted because nothing backs them, and each
 * is a different kind of missing:
 *
 *  - INTERNAL NOTES ("never shown to the customer", with an Add a note
 *    field). There is no notes table in 001_schema.sql at all. The nearest
 *    thing, orders.customer_note, is the CUSTOMER's note — showing it under
 *    a heading promising staff-only visibility would invert its meaning and
 *    could leak what a customer wrote into a context staff assume is
 *    private. Needs a table and a route, not a render.
 *
 *  - PAYMENT METHOD ("Visa ending 4242"). payments.card_brand and
 *    payments.card_last4 EXIST — but the Stripe webhook never writes them
 *    (it sets status and stripe_payment_intent_id only). So the row would be
 *    permanently blank. Worth saying precisely because this one is nearly
 *    free to fix: the brand and last4 are on the session's payment intent,
 *    so it is a few lines in the webhook away from being true.
 *
 *  - PHONE. Stripe only returns a shipping phone when checkout asks for it,
 *    and app/api/checkout does not. Rendered only when the snapshot happens
 *    to carry one rather than reserving a permanently empty row.
 *
 *  - "Expected 12–16 September" on the Delivered step. No delivery estimate
 *    is stored or computed anywhere; CLAUDE.md already records real delivery
 *    rates as blocked on the owner.
 *
 * The AUDIT HISTORY panel is real but will usually be empty, and that is
 * worth knowing rather than hiding: every audit_logs insert in this codebase
 * is a failure path (oversell_detected, email_delivery_failed). A payment
 * that succeeds writes nothing. The empty state says so instead of implying
 * nothing happened.
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, order_number, email, profile_id, subtotal_pence, delivery_pence, discount_pence, total_pence, payment_status, fulfilment_status, delivery_method, delivery_address, customer_note, placed_at, cancelled_at, cancel_reason',
    )
    .eq('id', id)
    .maybeSingle();
  // A query error and an unknown id both leave `order` null; only the second
  // is a 404 (CLAUDE.md's swallowed-error note).
  if (orderError) throw new Error(`Could not load the order: ${orderError.message}`);
  if (!order) notFound();

  const [items, payment, fulfilments, refunds, audit, settings] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, product_name, sku, colour, size, unit_price_pence, quantity, line_total_pence')
      .eq('order_id', id),
    supabase
      .from('payments')
      .select('stripe_payment_intent_id, amount_pence, status')
      .eq('order_id', id)
      .maybeSingle(),
    supabase
      .from('fulfilments')
      .select('id, carrier, tracking_number, tracking_url, shipped_at, delivered_at')
      .eq('order_id', id)
      .order('shipped_at', { ascending: true }),
    supabase
      .from('refunds')
      .select('id, amount_pence, kind, reason, note, restocked, actor_label, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('id, actor_label, action, summary, created_at')
      .eq('entity_type', 'order')
      .eq('entity_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('store_settings').select('free_delivery_threshold_pence').single(),
  ]);

  if (items.error) throw new Error(`Could not load the order's items: ${items.error.message}`);
  if (payment.error) throw new Error(`Could not load the payment: ${payment.error.message}`);
  if (fulfilments.error) throw new Error(`Could not load fulfilments: ${fulfilments.error.message}`);
  if (refunds.error) throw new Error(`Could not load refunds: ${refunds.error.message}`);
  if (audit.error) throw new Error(`Could not load the audit history: ${audit.error.message}`);
  if (settings.error) throw new Error(`Could not load store settings: ${settings.error.message}`);

  // "3 orders" on the Customer panel — every order placed with this email,
  // which is the only identifier a guest order has.
  const { count: orderCount, error: countError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('email', order.email);
  if (countError) throw new Error(`Could not count the customer's orders: ${countError.message}`);

  const shipped = fulfilments.data?.[0] ?? null;
  const refundedPence = (refunds.data ?? []).reduce((n, r) => n + r.amount_pence, 0);
  const refundablePence = Math.max(0, order.total_pence - refundedPence);
  const unitCount = (items.data ?? []).reduce((n, i) => n + i.quantity, 0);
  const steps = buildFulfilmentSteps({
    paymentStatus: order.payment_status,
    fulfilmentStatus: order.fulfilment_status,
    placedAt: order.placed_at,
    cancelledAt: order.cancelled_at,
    fulfilment: shipped,
  });

  const addr = (order.delivery_address ?? {}) as {
    name?: string;
    phone?: string;
    address?: Record<string, string | null | undefined>;
  };
  const line = addr.address ?? {};
  const addressLines = [
    addr.name,
    line.line1,
    line.line2,
    line.city,
    line.state,
    line.postal_code,
    countryName(orderCountryCode(order.delivery_address)),
  ].filter((v): v is string => Boolean(v && v !== '—'));

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            <Link href="/admin/orders" style={{ color: 'var(--mc-text-muted)' }}>
              ← Orders
            </Link>
          </p>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Order {order.order_number}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            Placed {formatLong(order.placed_at)} · {customerName(order.delivery_address, order.email)} ·{' '}
            {formatPence(order.total_pence)}
          </p>
        </div>
      </div>

      <div className="mc-admin-content">
        <div className="mc-admin-order-layout">
          <div className="mc-admin-order-main">
            <Panel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Badge map={PAYMENT_BADGE} value={order.payment_status} />
                <Badge map={FULFILMENT_BADGE} value={order.fulfilment_status} />
                <StatusBadge
                  label={shipped ? 'Shipped' : 'Not shipped'}
                  tone={shipped ? 'success' : 'neutral'}
                />
              </div>
              <p style={bodyStyle}>{statusSentence(order, Boolean(shipped))}</p>
            </Panel>

            <Panel heading="Items — snapshot taken when the order was placed">
              {(items.data ?? []).map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
                  {/* No product photography exists (README's blocked-on-owner
                      list), so this is the same honest well the storefront
                      cards use rather than a broken <img>. */}
                  <div
                    aria-hidden
                    style={{
                      width: 40,
                      height: 50,
                      flexShrink: 0,
                      background: 'var(--mc-mist)',
                      borderRadius: 'var(--mc-radius-sm)',
                    }}
                  />
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontSize: 14, margin: 0 }}>{item.product_name}</p>
                    <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
                      {item.colour} / {item.size} · {item.sku} · {item.quantity} ×{' '}
                      {formatPence(item.unit_price_pence)}
                    </p>
                  </div>
                  <p style={{ fontSize: 14, margin: 0, whiteSpace: 'nowrap' }}>
                    {formatPence(item.line_total_pence)}
                  </p>
                </div>
              ))}
              <Rule />
              <Row label="Subtotal" value={formatPence(order.subtotal_pence)} />
              <Row
                label={`Delivery${
                  settings.data?.free_delivery_threshold_pence
                    ? ` · free over ${formatPence(settings.data.free_delivery_threshold_pence)}`
                    : ''
                }`}
                value={order.delivery_pence === 0 ? 'Free' : formatPence(order.delivery_pence)}
              />
              {order.discount_pence > 0 && (
                <Row label="Discount" value={`−${formatPence(order.discount_pence)}`} />
              )}
              <Row label="Total paid" value={formatPence(order.total_pence)} strong />
              <p style={{ ...mutedSmall, marginTop: 12 }}>
                Names and prices here are frozen copies. Editing the product later does not change
                what this customer bought.
              </p>
            </Panel>

            <Panel heading="Fulfilment">
              {/* The one action A12 gained: A13 Pack exists now, so this
                  stops being a link to nowhere. The conditions mirror
                  advance_fulfilment's own refusals rather than guessing —
                  see the pack page's packBlocker. */}
              {order.payment_status === 'paid' &&
                !order.cancelled_at &&
                (order.fulfilment_status === 'not_started' ||
                  order.fulfilment_status === 'processing') && (
                  <p style={{ margin: '0 0 4px' }}>
                    <Link href={`/admin/orders/${order.id}/pack`} style={secondaryButtonStyle}>
                      Pack this order
                    </Link>
                  </p>
                )}
              {steps.map((step) => (
                <div key={step.label} style={{ display: 'flex', gap: 12, padding: '6px 0' }}>
                  <span
                    aria-hidden
                    style={{
                      width: step.state === 'current' ? 14 : 10,
                      height: step.state === 'current' ? 14 : 10,
                      marginTop: 5,
                      flexShrink: 0,
                      borderRadius: '50%',
                      background:
                        step.state === 'todo' ? 'transparent' : 'var(--mc-text-primary)',
                      border: step.state === 'todo' ? '1px solid var(--mc-border-control)' : 'none',
                    }}
                  />
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p style={{ fontSize: 14, margin: 0, fontWeight: step.state === 'current' ? 600 : 400 }}>
                      {step.label}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>{step.detail}</p>
                  </div>
                </div>
              ))}
            </Panel>

            <Panel heading="Audit history">
              {(audit.data ?? []).length === 0 ? (
                <p style={mutedSmall}>
                  Nothing recorded against this order. Only failures are written to the audit log
                  today — an oversell, or an email that could not be sent — so an empty list here
                  means nothing went wrong, not that nothing happened.
                </p>
              ) : (
                (audit.data ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', padding: '9px 0' }}
                  >
                    <p style={{ fontSize: 13, margin: 0 }}>{entry.summary}</p>
                    <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0, whiteSpace: 'nowrap' }}>
                      {entry.actor_label} · {formatShort(entry.created_at)}
                    </p>
                  </div>
                ))
              )}
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            <Panel heading="Customer">
              <Field label="Name" value={customerName(order.delivery_address, order.email)} />
              <Field label="Email" value={order.email} />
              {addr.phone && <Field label="Phone" value={addr.phone} />}
              <Field
                label="History"
                value={`${orderCount ?? 1} order${(orderCount ?? 1) === 1 ? '' : 's'}${
                  order.profile_id ? '' : ' · guest checkout'
                }`}
              />
            </Panel>

            <Panel heading="Delivery address">
              {addressLines.length ? (
                addressLines.map((l, i) => (
                  <p key={i} style={{ fontSize: 14, margin: 0, lineHeight: '20px' }}>
                    {l}
                  </p>
                ))
              ) : (
                <p style={mutedSmall}>
                  No address yet. Stripe writes it when the payment completes, so an unpaid order
                  has none.
                </p>
              )}
              {order.delivery_method && (
                <div style={{ marginTop: 12 }}>
                  <Field label="Method" value={order.delivery_method} />
                </div>
              )}
              {order.customer_note && (
                <div style={{ marginTop: 12 }}>
                  {/* The customer's own note from checkout. Labelled as theirs
                      — the design's "internal notes, never shown to the
                      customer" panel is a different thing that has no table. */}
                  <Field label="Note from the customer" value={order.customer_note} />
                </div>
              )}
            </Panel>

            <Panel heading="Payment">
              <Field label="Status" value={PAYMENT_BADGE[order.payment_status]?.label ?? order.payment_status} />
              <Field label="Amount" value={formatPence(payment.data?.amount_pence ?? order.total_pence)} />
              {payment.data?.stripe_payment_intent_id ? (
                <>
                  <Field label="Stripe payment intent" value={payment.data.stripe_payment_intent_id} />
                  <p style={{ marginTop: 12 }}>
                    <a
                      href={`https://dashboard.stripe.com/payments/${payment.data.stripe_payment_intent_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={secondaryButtonStyle}
                    >
                      Open in Stripe
                    </a>
                  </p>
                </>
              ) : (
                <p style={mutedSmall}>
                  No payment intent yet — Stripe sets it when the checkout session completes.
                </p>
              )}
              {refundedPence > 0 && (
                <>
                  <Rule />
                  <Field label="Refunded" value={formatPence(refundedPence)} />
                  {(refunds.data ?? []).map((r) => (
                    <p key={r.id} style={mutedSmall}>
                      {formatPence(r.amount_pence)} · {r.reason} · {r.actor_label} ·{' '}
                      {formatShort(r.created_at)}
                      {r.restocked ? ' · stock restored' : ' · stock not restored'}
                      {r.note ? ` — ${r.note}` : ''}
                    </p>
                  ))}
                </>
              )}
            </Panel>

            {/* A15 and A16. Both are real now, so unlike the six actions this
                screen still omits they are not links to nowhere. Each is
                shown only in the states its own Postgres function will
                accept — a dialog that always opens and always fails is the
                same dead end a disabled button with no explanation is.
                
                Hidden below 768 by the same rule components/admin/wide-only
                states and A15/A16 follow: of 23 admin screens the 16 without
                a Mobile frame are the editors and the consequential actions,
                and these two are on that list. A12 itself has a phone layout
                and keeps it — it is the reading that works on a phone, not
                the refunding. Both branches are in the DOM and swapped by
                CSS, because a JS width check flashes the wrong one. */}
            {(canCancel(order) || canRefund(order, refundablePence)) && (
              <div className="mc-admin-narrow-notice">
                <Panel heading="Actions">
                  <p style={mutedSmall}>
                    Cancelling and refunding this order are done from a tablet or a desktop. They
                    move real money and Figma never drew either at this width.
                  </p>
                </Panel>
              </div>
            )}
            {(canCancel(order) || canRefund(order, refundablePence)) && (
              <div className="mc-admin-wide-only">
              <Panel heading="Actions">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {canCancel(order) && (
                    <CancelOrder
                      orderId={order.id}
                      orderNumber={order.order_number}
                      customer={customerName(order.delivery_address, order.email)}
                      itemCount={(items.data ?? []).length}
                      unitCount={unitCount}
                      totalPence={order.total_pence}
                      paymentStatus={order.payment_status}
                      paymentLabel={PAYMENT_BADGE[order.payment_status]?.label ?? order.payment_status}
                      skuSummary={(items.data ?? [])
                        .map((i) => `${i.quantity} × ${i.sku}`)
                        .join(', ')}
                    />
                  )}
                  {canRefund(order, refundablePence) && (
                    <RefundOrder
                      orderId={order.id}
                      orderNumber={order.order_number}
                      customer={customerName(order.delivery_address, order.email)}
                      itemCount={(items.data ?? []).length}
                      totalPence={order.total_pence}
                      alreadyRefundedPence={refundedPence}
                      paymentLabel={PAYMENT_BADGE[order.payment_status]?.label ?? order.payment_status}
                    />
                  )}
                </div>
                <p style={mutedSmall}>
                  Cancelling refunds everything and puts the stock back, because the parcel never
                  left. A refund is money only — stock is a separate tick box on that dialog.
                </p>
              </Panel>
              </div>
            )}

            <Panel heading="Tracking">
              {shipped ? (
                <>
                  <Field label="Carrier" value={shipped.carrier} />
                  <Field label="Tracking number" value={shipped.tracking_number} />
                  {shipped.tracking_url && (
                    <p style={{ marginTop: 12 }}>
                      <a href={shipped.tracking_url} target="_blank" rel="noreferrer" style={secondaryButtonStyle}>
                        Track parcel
                      </a>
                    </p>
                  )}
                </>
              ) : order.payment_status !== 'paid' ? (
                <p style={mutedSmall}>
                  Tracking can be added once the payment is confirmed — ship_order refuses an
                  unpaid order, so the form stays out of the way until then.
                </p>
              ) : order.cancelled_at ? (
                <p style={mutedSmall}>This order was cancelled, so there is nothing to dispatch.</p>
              ) : (
                <AddTracking
                  orderId={order.id}
                  orderNumber={order.order_number}
                  customer={customerName(order.delivery_address, order.email)}
                  email={order.email}
                  itemCount={(items.data ?? []).reduce((n, i) => n + i.quantity, 0)}
                  totalPence={order.total_pence}
                  paymentLabel={PAYMENT_BADGE[order.payment_status]?.label ?? order.payment_status}
                />
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The design's sentence, rebuilt from real state. Its version promises
 * "cancelled without a refund fee", which is a commercial claim nothing in
 * this codebase implements or charges — dropped rather than repeated. */
function statusSentence(
  order: { payment_status: string; placed_at: string; cancelled_at: string | null; cancel_reason: string | null },
  hasShipped: boolean,
): string {
  if (order.cancelled_at) {
    return `Cancelled ${formatLong(order.cancelled_at)}${
      order.cancel_reason ? ` — ${order.cancel_reason}` : ''
    }.`;
  }
  if (order.payment_status === 'paid' && !hasShipped) {
    return `Paid in full ${formatLong(order.placed_at)}. Nothing has shipped yet.`;
  }
  if (order.payment_status === 'paid' && hasShipped) {
    return `Paid in full ${formatLong(order.placed_at)} and dispatched.`;
  }
  if (order.payment_status === 'pending') {
    return 'Awaiting payment. Stripe has not confirmed this checkout session yet.';
  }
  if (order.payment_status === 'failed') {
    return 'Payment failed. Nothing was charged and nothing should be sent.';
  }
  return `Placed ${formatLong(order.placed_at)}.`;
}

/** Mirrors cancel_order's own refusals: already cancelled, or already gone.
 * An unpaid order can still be cancelled — there is simply nothing to send
 * back, which the dialog says rather than promising a refund. */
function canCancel(order: { fulfilment_status: string; cancelled_at: string | null }): boolean {
  if (order.cancelled_at || order.fulfilment_status === 'cancelled') return false;
  return order.fulfilment_status !== 'shipped' && order.fulfilment_status !== 'delivered';
}

/** Mirrors record_refund's: something was paid, and some of it is still
 * owed. A fully refunded order shows the history above instead. */
function canRefund(order: { payment_status: string }, refundablePence: number): boolean {
  if (refundablePence <= 0) return false;
  return order.payment_status === 'paid' || order.payment_status === 'partially_refunded';
}

function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function Badge({
  map,
  value,
}: {
  map: Record<string, { label: string; tone: 'success' | 'attention' | 'danger' | 'neutral' | 'info' }>;
  value: string;
}) {
  const entry = map[value] ?? { label: value, tone: 'neutral' as const };
  return <StatusBadge label={entry.label} tone={entry.tone} />;
}

function Panel({ heading, children }: { heading?: string; children: React.ReactNode }) {
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
      {heading && (
        <>
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
          <Rule />
        </>
      )}
      {children}
    </section>
  );
}

function Rule() {
  return <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, color: strong ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: strong ? 16 : 14, fontWeight: strong ? 600 : 400, whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  border: '1px solid var(--mc-border-strong)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  color: 'var(--mc-text-primary)',
  textDecoration: 'none',
};
