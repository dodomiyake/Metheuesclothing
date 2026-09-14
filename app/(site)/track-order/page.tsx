'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { formatPence } from '@/lib/money';
import {
  fieldStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  secondaryButtonStyle,
  disabledSecondaryButtonStyle,
  ghostButtonStyle,
  headStyle,
  titleStyle,
  subtextStyle,
  helperStyle,
  errorStyle,
} from '../form-styles';

type OrderItem = {
  id: string;
  product_name: string;
  colour: string;
  size: string;
  quantity: number;
  unit_price_pence: number;
  line_total_pence: number;
};

type Fulfilment = {
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

type Order = {
  order_number: string;
  placed_at: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  fulfilment_status: 'not_started' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal_pence: number;
  delivery_pence: number;
  discount_pence: number;
  total_pence: number;
  delivery_method: string | null;
  delivery_address: { name?: string; address?: Record<string, string> } | null;
  cancelled_at: string | null;
};

type Settings = { return_window_days: number; vat_rate_basis_points: number };

const REASON_LABELS: Record<string, string> = {
  too_small: 'Too small',
  too_large: 'Too large',
  not_as_described: 'Not as described',
  faulty: 'Faulty',
  changed_mind: 'Changed my mind',
  wrong_item_sent: 'Wrong item sent',
  arrived_late: 'Arrived late',
};

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  tracked_48: 'Tracked 48',
  next_day: 'Next working day',
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * §17 screen 28 (guest order lookup) into §8.11 (return request), rebuilt
 * against the real design system rather than the earlier plain-input MVP.
 * There is no dedicated Figma screen for the guest lookup form itself —
 * "12 Orders" (the signed-in Orders list) only carries a small CTA
 * pointing a guest elsewhere, confirmed by pulling its metadata rather
 * than guessing from the design-system-state.json note that flagged the
 * uncertainty. So the lookup form reuses the one real pattern this app
 * has for "a small identifying form on its own page": the same Form
 * Field / Button styling the auth screens are matched against
 * (../form-styles, now shared beyond the auth cluster for exactly this).
 *
 * The result view does have a real match: CLAUDE.md's own note that
 * "track-order has no order detail page of its own — everything it shows
 * lives on the one lookup-result page" already meant this was always
 * meant to borrow Order Detail's content, not stay a generic summary.
 * Rebuilt against 13 Order Detail (node 103:3631) with the account-only
 * chrome removed (nav rail, "Your account" breadcrumb, "All orders" back
 * link — none apply to a guest with no account) and every field backed
 * by a real column:
 * - The 5-step progress timeline (done/current/todo dot treatment) comes
 *   from payment_status/fulfilment_status/fulfilments, with a sub-date
 *   shown only for steps that have a real timestamp (placed_at,
 *   shipped_at, delivered_at) — the mockup's "Payment confirmed" and
 *   "Preparing" steps show a fabricated time this app doesn't track.
 * - The Payment section (card brand/last4, billing address) is omitted
 *   entirely: `payments.card_brand`, `.card_last4` and
 *   `orders.billing_address` exist as columns but no code path in this
 *   app ever writes to them, so they would always render empty.
 * - "Cancel this order" is omitted, not disabled-with-explanation: there
 *   is no cancel-order route to ever enable it, and the Button
 *   component's own rule is that a disabled control needs real text
 *   about what would enable it, not a permanent dead end.
 * - "Start a Return" gates on real data: disabled until the order is
 *   actually delivered (matching the design's own helper copy, stricter
 *   than request_return()'s fallback-to-shipped/placed window start,
 *   which exists as a safety net for orders with incomplete fulfilment
 *   records rather than as the primary UX rule) or until store_settings
 *   .return_window_days has actually elapsed since delivery — both
 *   computed from real data, not the mockup's hardcoded "30 days".
 * - Estimated VAT is computed from store_settings.vat_rate_basis_points
 *   (a real, seeded column) rather than shown as a flat "Included" label.
 */
export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [fulfilments, setFulfilments] = useState<Fulfilment[]>([]);
  const [settings, setSettings] = useState<Settings>({ return_window_days: 30, vat_rate_basis_points: 2000 });

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLooking(true);
    const res = await fetch('/api/orders/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: orderNumber, email }),
    });
    setLooking(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Same message whether the order doesn't exist or the email is wrong
      // -- rule 6, this is exactly the endpoint it's written for.
      setLookupError(body.error ?? 'We could not find an order with that number and email address.');
      return;
    }
    setOrder(body.order);
    setItems(body.items ?? []);
    setFulfilments(body.fulfilments ?? []);
    if (body.settings) setSettings(body.settings);
  }

  if (!order) {
    return (
      <main className="mc-page-gutter" style={{ display: 'flex', justifyContent: 'center', paddingTop: 56, paddingBottom: 72, fontFamily: 'var(--mc-font-body)' }}>
        <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={headStyle}>
            <h1 style={titleStyle}>Track your order</h1>
            <p style={subtextStyle}>Enter your order number and the email address you checked out with.</p>
          </div>

          <form onSubmit={onLookup} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {lookupError && (
              <p role="alert" style={errorStyle}>
                {lookupError}
              </p>
            )}
            <label style={fieldStyle}>
              <span style={labelStyle}>Order number</span>
              <input
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="MC-10001"
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Email address</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </label>
            <button type="submit" disabled={looking} style={buttonStyle}>
              {looking ? 'Looking up…' : 'Find my order'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const vatPence = Math.round((order.total_pence * settings.vat_rate_basis_points) / (10000 + settings.vat_rate_basis_points));
  const status = statusFor(order);
  const deliveredAt = fulfilments.find((f) => f.delivered_at)?.delivered_at ?? null;
  const shippedAt = fulfilments.find((f) => f.shipped_at)?.shipped_at ?? null;
  const trackable = fulfilments.find((f) => f.tracking_number);

  return (
    <main className="mc-page-gutter" style={{ paddingTop: 'var(--mc-space-xl)', paddingBottom: 80, fontFamily: 'var(--mc-font-body)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 'var(--mc-space-lg)' }}>
        <div>
          <button
            type="button"
            onClick={() => setOrder(null)}
            style={{ ...ghostButtonStyle, padding: 0, minHeight: 'auto', fontSize: 13, fontWeight: 400, color: 'var(--mc-text-muted)' }}
          >
            ← Look up another order
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
              Order {order.order_number}
            </h1>
            <p style={{ color: 'var(--mc-text-muted)', fontSize: 14, margin: '4px 0 0' }}>
              Placed {new Date(order.placed_at).toLocaleDateString('en-GB', DATE_FORMAT)} · {totalQuantity} item
              {totalQuantity === 1 ? '' : 's'} · {formatPence(order.total_pence)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: status.colour }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{status.label}</span>
          </div>
        </div>

        <div className="mc-order-detail-layout">
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--mc-space-lg)' }}>
            {order.cancelled_at ? (
              <Card title="Progress">
                <p style={{ fontWeight: 600, color: 'var(--mc-status-attention)', margin: 0 }}>
                  This order was cancelled on {new Date(order.cancelled_at).toLocaleDateString('en-GB', DATE_FORMAT)}.
                </p>
              </Card>
            ) : (
              <Card title="Progress">
                <Timeline order={order} shippedAt={shippedAt} deliveredAt={deliveredAt} />
              </Card>
            )}

            <Card title="Items in this order">
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--mc-border-default)' }}>
                  <div style={{ width: 64, height: 80, background: 'var(--mc-sand)', borderRadius: 'var(--mc-radius-sm)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>{item.product_name}</p>
                    <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: '0 0 4px' }}>
                      {item.colour} / {item.size}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>Quantity {item.quantity}</p>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 500, margin: 0, whiteSpace: 'nowrap' }}>{formatPence(item.line_total_pence)}</p>
                </div>
              ))}
            </Card>

            {order.delivery_address?.address && (
              <Card title="Delivery">
                <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
                  {order.delivery_address.name}
                  <br />
                  {Object.values(order.delivery_address.address).filter(Boolean).join(', ')}
                </p>
                {order.delivery_method && (
                  <SummaryRow label="Method" value={DELIVERY_METHOD_LABELS[order.delivery_method] ?? order.delivery_method} />
                )}
                {trackable && <SummaryRow label="Tracking number" value={trackable.tracking_number ?? ''} />}
                {trackable?.tracking_url && (
                  <a href={trackable.tracking_url} style={{ ...secondaryButtonStyle, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16, boxSizing: 'border-box' }}>
                    Track parcel
                  </a>
                )}
              </Card>
            )}
          </div>

          <div className="mc-order-detail-side">
            <Card title="Order summary">
              <SummaryRow label={`Subtotal (${totalQuantity} item${totalQuantity === 1 ? '' : 's'})`} value={formatPence(order.subtotal_pence)} />
              <SummaryRow label="Delivery" value={order.delivery_pence === 0 ? 'Free' : formatPence(order.delivery_pence)} />
              {order.discount_pence > 0 && <SummaryRow label="Discount" value={`−${formatPence(order.discount_pence)}`} />}
              <SummaryRow label="VAT included" value={formatPence(vatPence)} />
              <div style={{ borderTop: '1px solid var(--mc-border-default)', marginTop: 8, paddingTop: 8 }}>
                <SummaryRow label="Total paid" value={formatPence(order.total_pence)} big />
              </div>
              <p style={{ ...helperStyle, marginTop: 12 }}>Paid in GBP. VAT is included in the prices shown.</p>
            </Card>

            {!order.cancelled_at && (
              <ReturnPanel order={order} deliveredAt={deliveredAt} returnWindowDays={settings.return_window_days} email={email} items={items} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function statusFor(order: Order): { label: string; colour: string } {
  if (order.cancelled_at) return { label: 'Cancelled', colour: 'var(--mc-status-attention)' };
  if (order.payment_status === 'refunded') return { label: 'Refunded', colour: 'var(--mc-status-attention)' };
  if (order.payment_status === 'partially_refunded') return { label: 'Partially refunded', colour: 'var(--mc-status-attention)' };
  if (order.fulfilment_status === 'delivered') return { label: 'Delivered', colour: 'var(--mc-status-success)' };
  if (order.fulfilment_status === 'shipped') return { label: 'Shipped', colour: 'var(--mc-status-success)' };
  if (order.fulfilment_status === 'processing' || order.fulfilment_status === 'packed') {
    return { label: 'Preparing', colour: 'var(--mc-text-primary)' };
  }
  if (order.payment_status === 'paid') return { label: 'Paid', colour: 'var(--mc-text-primary)' };
  return { label: 'Processing', colour: 'var(--mc-text-muted)' };
}

function Timeline({ order, shippedAt, deliveredAt }: { order: Order; shippedAt: string | null; deliveredAt: string | null }) {
  const paid = order.payment_status !== 'pending' && order.payment_status !== 'failed';
  // "Reached" tracks how far fulfilment has actually gotten; "current" below
  // is which single step is in progress right now, not just which steps
  // have been reached -- conflating the two here once made a processing
  // order (reached preparing, not yet shipped) show Dispatched as current
  // instead of Preparing your order.
  const reachedShipped = ['shipped', 'delivered'].includes(order.fulfilment_status);
  const reachedDelivered = order.fulfilment_status === 'delivered';

  const steps: { label: string; state: 'done' | 'current' | 'todo'; detail?: string }[] = [
    { label: 'Order placed', state: 'done', detail: new Date(order.placed_at).toLocaleDateString('en-GB', DATE_FORMAT) },
    { label: 'Payment confirmed', state: paid ? 'done' : 'todo' },
    {
      label: 'Preparing your order',
      state: reachedShipped ? 'done' : paid ? 'current' : 'todo',
    },
    {
      label: 'Dispatched',
      state: reachedDelivered ? 'done' : reachedShipped ? 'current' : 'todo',
      detail: shippedAt ? new Date(shippedAt).toLocaleDateString('en-GB', DATE_FORMAT) : undefined,
    },
    {
      label: 'Delivered',
      state: reachedDelivered ? 'done' : 'todo',
      detail: deliveredAt ? new Date(deliveredAt).toLocaleDateString('en-GB', DATE_FORMAT) : undefined,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {steps.map((step) => (
        <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              marginTop: 5,
              width: step.state === 'current' ? 14 : step.state === 'done' ? 10 : 12,
              height: step.state === 'current' ? 14 : step.state === 'done' ? 10 : 12,
              borderRadius: '50%',
              background: step.state === 'current' ? 'var(--mc-status-success)' : step.state === 'done' ? 'var(--mc-text-primary)' : 'transparent',
              border: step.state === 'todo' ? '1px solid var(--mc-border-default)' : 'none',
            }}
          />
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: step.state === 'current' ? 600 : 500,
                color: step.state === 'todo' ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
                margin: 0,
              }}
            >
              {step.label}
            </p>
            {(step.detail || step.state === 'current') && (
              <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: '3px 0 0' }}>
                {step.state === 'current' ? 'Current step' : step.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReturnPanel({
  order,
  deliveredAt,
  returnWindowDays,
  email,
  items,
}: {
  order: Order;
  deliveredAt: string | null;
  returnWindowDays: number;
  email: string;
  items: OrderItem[];
}) {
  const [open, setOpen] = useState(false);

  const eligiblePaymentState = order.payment_status === 'paid' || order.payment_status === 'partially_refunded';
  let gate: { enabled: boolean; helper: string };

  if (!eligiblePaymentState) {
    gate = { enabled: false, helper: 'Returns are only available for paid orders.' };
  } else if (!deliveredAt) {
    gate = { enabled: false, helper: `Returns open once your order is delivered, and stay open for ${returnWindowDays} days after that.` };
  } else {
    const closesAt = new Date(deliveredAt);
    closesAt.setDate(closesAt.getDate() + returnWindowDays);
    if (Date.now() > closesAt.getTime()) {
      gate = { enabled: false, helper: `The ${returnWindowDays}-day return window for this order closed on ${closesAt.toLocaleDateString('en-GB', DATE_FORMAT)}.` };
    } else {
      gate = { enabled: true, helper: `Returns close on ${closesAt.toLocaleDateString('en-GB', DATE_FORMAT)}.` };
    }
  }

  return (
    <Card title="Need something else?">
      <button
        type="button"
        disabled={!gate.enabled}
        onClick={() => setOpen(true)}
        style={gate.enabled ? { ...secondaryButtonStyle } : { ...disabledSecondaryButtonStyle }}
      >
        Start a return
      </button>
      <p style={{ ...helperStyle, marginTop: 12 }}>{gate.helper}</p>

      <Link href="/contact" style={{ ...ghostButtonStyle, width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 8, boxSizing: 'border-box' }}>
        Contact us about this order
      </Link>

      {open && gate.enabled && (
        <div style={{ marginTop: 16 }}>
          <ReturnRequestForm orderNumber={order.order_number} email={email} items={items} />
        </div>
      )}
    </Card>
  );
}

function ReturnRequestForm({ orderNumber, email, items }: { orderNumber: string; email: string; items: OrderItem[] }) {
  const [selected, setSelected] = useState<Record<string, { checked: boolean; quantity: number; reason: string }>>(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, { checked: false, quantity: 1, reason: 'changed_mind' }]),
      ),
  );
  const [customerNote, setCustomerNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [returnNumber, setReturnNumber] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(itemId: string, patch: Partial<{ checked: boolean; quantity: number; reason: string }>) {
    setSelected((s) => ({ ...s, [itemId]: { ...s[itemId], ...patch } }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const chosen = items
      .filter((item) => selected[item.id]?.checked)
      .map((item) => ({
        order_item_id: item.id,
        quantity: selected[item.id].quantity,
        reason: selected[item.id].reason,
      }));
    if (chosen.length === 0) {
      setError('Select at least one item to return.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_number: orderNumber,
        email,
        items: chosen,
        customer_note: customerNote || undefined,
      }),
    });
    setSubmitting(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // request_return()'s own message -- specific on purpose, since order
      // number + email were already proven at the lookup step above.
      setError(body.error ?? 'We could not create that return.');
      return;
    }
    setReturnNumber(body.return_number);
  }

  if (returnNumber) {
    return (
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Return <strong>{returnNumber}</strong> has been requested. We&rsquo;ve sent a confirmation to {email} — someone
        from our team will follow up with instructions.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      {items.map((item) => {
        const line = selected[item.id];
        return (
          <div key={item.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--mc-border-default)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={line.checked}
                onChange={(e) => update(item.id, { checked: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              {item.product_name} — {item.colour} / {item.size}
            </label>
            {line.checked && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8, marginLeft: 26, flexWrap: 'wrap' }}>
                <label>
                  <span style={{ fontSize: 12, color: 'var(--mc-text-muted)', marginRight: 4 }}>Qty</span>
                  <input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={line.quantity}
                    onChange={(e) => update(item.id, { quantity: Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)) })}
                    style={{ width: 56, minHeight: 32, padding: '2px 6px' }}
                  />
                </label>
                <select value={line.reason} onChange={(e) => update(item.id, { reason: e.target.value })} style={{ minHeight: 32 }}>
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
      <label style={fieldStyle}>
        <span style={labelStyle}>Anything else? (optional)</span>
        <textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} />
      </label>
      <button type="submit" disabled={submitting} style={buttonStyle}>
        {submitting ? 'Submitting…' : 'Request return'}
      </button>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--mc-bg-surface)', border: '1px solid var(--mc-border-default)', borderRadius: 4, padding: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--mc-text-muted)', margin: '0 0 14px' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', fontSize: big ? 17 : 15, fontWeight: big ? 600 : 400 }}>
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
