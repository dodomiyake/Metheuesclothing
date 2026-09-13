'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import { formatPence } from '@/lib/money';

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
  payment_status: string;
  fulfilment_status: string;
  subtotal_pence: number;
  delivery_pence: number;
  discount_pence: number;
  total_pence: number;
  delivery_method: string | null;
  delivery_address: { name?: string; address?: Record<string, string> } | null;
  cancelled_at: string | null;
};

const REASON_LABELS: Record<string, string> = {
  too_small: 'Too small',
  too_large: 'Too large',
  not_as_described: 'Not as described',
  faulty: 'Faulty',
  changed_mind: 'Changed my mind',
  wrong_item_sent: 'Wrong item sent',
  arrived_late: 'Arrived late',
};

const TIMELINE = ['Confirmed', 'Preparing', 'Shipped', 'Delivered'] as const;

function currentStep(order: Order): number {
  if (order.fulfilment_status === 'delivered') return 3;
  if (order.fulfilment_status === 'shipped') return 2;
  if (order.payment_status === 'paid') return 1;
  return 0;
}

/**
 * §17 screen 28 (guest order lookup) into §8.11 (return request) — both
 * POST /api/orders/lookup and POST /api/returns have existed since early in
 * this project's history with no page in front of either. Order number and
 * email together are what the lookup route accepts (rule 5: never email
 * alone), and the same pair authorises the return that follows it.
 */
export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [fulfilments, setFulfilments] = useState<Fulfilment[]>([]);

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
  }

  if (!order) {
    return (
      <main style={{ padding: 'var(--mc-space-xl) var(--mc-gutter-desktop)', fontFamily: 'var(--mc-font-body)', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
          Track your order
        </h1>
        <form onSubmit={onLookup}>
          {lookupError && (
            <p role="alert" style={{ color: 'var(--mc-status-error)' }}>
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
          <label style={{ ...fieldStyle, marginBottom: 'var(--mc-space-lg)' }}>
            <span style={labelStyle}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button type="submit" disabled={looking} style={buttonStyle}>
            {looking ? 'Looking up…' : 'Find my order'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ padding: 'var(--mc-space-xl) var(--mc-gutter-desktop)', fontFamily: 'var(--mc-font-body)', maxWidth: 720 }}>
      <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
        Order {order.order_number}
      </h1>
      <p style={{ color: 'var(--mc-text-muted)' }}>
        Placed {new Date(order.placed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {order.cancelled_at ? (
        <p style={{ fontWeight: 600, color: 'var(--mc-status-attention)' }}>This order was cancelled.</p>
      ) : (
        <Timeline step={currentStep(order)} />
      )}

      {fulfilments.some((f) => f.tracking_number) && (
        <div style={{ margin: 'var(--mc-space-md) 0' }}>
          {fulfilments
            .filter((f) => f.tracking_number)
            .map((f, i) => (
              <p key={i} style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
                {f.carrier ?? 'Courier'} tracking:{' '}
                {f.tracking_url ? (
                  <a href={f.tracking_url} style={{ color: 'var(--mc-text-primary)' }}>
                    {f.tracking_number}
                  </a>
                ) : (
                  f.tracking_number
                )}
              </p>
            ))}
        </div>
      )}

      <Section title="Items">
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--mc-space-xs) 0', borderBottom: '1px solid var(--mc-border-default)' }}>
            <div>
              <div>{item.product_name}</div>
              <div style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
                {item.colour} / {item.size} · Qty {item.quantity}
              </div>
            </div>
            <div>{formatPence(item.line_total_pence)}</div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--mc-space-sm)', fontWeight: 700 }}>
          <span>Total paid</span>
          <span>{formatPence(order.total_pence)}</span>
        </div>
      </Section>

      {order.delivery_address?.address && (
        <Section title="Delivered to">
          <p>
            {order.delivery_address.name}
            <br />
            {Object.values(order.delivery_address.address).filter(Boolean).join(', ')}
          </p>
        </Section>
      )}

      {!order.cancelled_at && order.payment_status === 'paid' && (
        <ReturnRequestForm orderNumber={order.order_number} email={email} items={items} />
      )}
    </main>
  );
}

function Timeline({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--mc-space-sm)', margin: 'var(--mc-space-md) 0' }}>
      {TIMELINE.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i <= step ? 'var(--mc-forest)' : 'transparent',
              border: i <= step ? 'none' : '1px solid var(--mc-border-default)',
            }}
          />
          <span
            style={{
              fontSize: 'var(--mc-type-caption)',
              fontWeight: i === step ? 700 : 400,
              color: i <= step ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)',
            }}
          >
            {label}
          </span>
          {i < TIMELINE.length - 1 && <span style={{ color: 'var(--mc-border-default)' }}>—</span>}
        </div>
      ))}
    </div>
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
      <Section title="Return requested">
        <p>
          Return <strong>{returnNumber}</strong> has been requested. We&rsquo;ve sent a confirmation to {email} —
          someone from our team will follow up with instructions.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Request a return">
      <form onSubmit={onSubmit}>
        {error && (
          <p role="alert" style={{ color: 'var(--mc-status-error)' }}>
            {error}
          </p>
        )}
        {items.map((item) => {
          const line = selected[item.id];
          return (
            <div key={item.id} style={{ padding: 'var(--mc-space-sm) 0', borderBottom: '1px solid var(--mc-border-default)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={line.checked}
                  onChange={(e) => update(item.id, { checked: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                {item.product_name} — {item.colour} / {item.size}
              </label>
              {line.checked && (
                <div style={{ display: 'flex', gap: 'var(--mc-space-sm)', marginTop: 'var(--mc-space-2xs)', marginLeft: 26, flexWrap: 'wrap' }}>
                  <label>
                    <span style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)', marginRight: 4 }}>Qty</span>
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
        <label style={{ display: 'block', margin: 'var(--mc-space-md) 0' }}>
          <span style={labelStyle}>Anything else? (optional)</span>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            style={{ ...inputStyle, minHeight: 60 }}
          />
        </label>
        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? 'Submitting…' : 'Request return'}
        </button>
      </form>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--mc-space-lg)' }}>
      <h2 style={{ fontSize: 'var(--mc-type-label)', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--mc-text-muted)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

const fieldStyle: CSSProperties = { display: 'block', marginBottom: 'var(--mc-space-md)' };
const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--mc-type-caption)',
  color: 'var(--mc-text-muted)',
  marginBottom: 4,
};
const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--mc-border-default)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  boxSizing: 'border-box',
};
const buttonStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 var(--mc-space-xl)',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  fontWeight: 600,
  cursor: 'pointer',
};
