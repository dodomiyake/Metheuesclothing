'use client';

import { useState, type FormEvent } from 'react';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, errorStyle } from '@/app/(site)/form-styles';

export type ReturnableItem = {
  id: string;
  product_name: string;
  colour: string;
  size: string;
  quantity: number;
};

/** §11's reasons, the same set request_return() accepts. */
export const RETURN_REASON_LABELS: Record<string, string> = {
  too_small: 'Too small',
  too_large: 'Too large',
  not_as_described: 'Not as described',
  faulty: 'Faulty',
  changed_mind: 'Changed my mind',
  wrong_item_sent: 'Wrong item sent',
  arrived_late: 'Arrived late',
};

/**
 * 14 Start a Return's form, lifted out of the track-order page so the
 * account cluster's 13 Order Detail can use the same one.
 *
 * ONE FORM, because there is one endpoint and one Postgres function behind
 * it. POST /api/returns proves order number AND email together (rule 5)
 * whether a guest typed them or a signed-in customer's session supplied
 * them, and request_return() applies the window and the quantity checks —
 * a second copy of this form would be a second place for those rules to be
 * approximated.
 *
 * The design's two-step flow (14 then 15 Review Return) collapses to one
 * panel here, which is what track-order shipped and what this keeps: the
 * review step in the frames exists to choose drop-off vs collection, and
 * nothing in this system arranges either.
 */
export function ReturnRequestForm({
  orderNumber,
  email,
  items,
  onDone,
}: {
  orderNumber: string;
  email: string;
  items: ReturnableItem[];
  onDone?: (returnNumber: string) => void;
}) {
  const [selected, setSelected] = useState<
    Record<string, { checked: boolean; quantity: number; reason: string }>
  >(() =>
    Object.fromEntries(items.map((item) => [item.id, { checked: false, quantity: 1, reason: 'changed_mind' }])),
  );
  const [customerNote, setCustomerNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [returnNumber, setReturnNumber] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(
    itemId: string,
    patch: Partial<{ checked: boolean; quantity: number; reason: string }>,
  ) {
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
      // request_return()'s own message — specific on purpose, since the
      // order number and email were proven before this form was reachable.
      setError(body.error ?? 'We could not create that return.');
      return;
    }
    setReturnNumber(body.return_number);
    onDone?.(body.return_number);
  }

  if (returnNumber) {
    return (
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Return <strong>{returnNumber}</strong> has been requested. We&rsquo;ve sent a confirmation to{' '}
        {email} — someone from our team will follow up with instructions.
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
                    onChange={(e) =>
                      update(item.id, {
                        quantity: Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)),
                      })
                    }
                    style={{ width: 56, minHeight: 32, padding: '2px 6px' }}
                  />
                </label>
                <select
                  value={line.reason}
                  onChange={(e) => update(item.id, { reason: e.target.value })}
                  style={{ minHeight: 32 }}
                >
                  {Object.entries(RETURN_REASON_LABELS).map(([value, label]) => (
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
  );
}

/**
 * The gate, stated in one place. A disabled control must say what would
 * enable it (the Button component's own rule), and these three sentences
 * are what request_return() actually enforces.
 */
export function returnGate({
  paymentStatus,
  deliveredAt,
  returnWindowDays,
}: {
  paymentStatus: string;
  deliveredAt: string | null;
  returnWindowDays: number;
}): { enabled: boolean; helper: string } {
  const paid = paymentStatus === 'paid' || paymentStatus === 'partially_refunded';
  if (!paid) return { enabled: false, helper: 'Returns are only available for paid orders.' };
  if (!deliveredAt) {
    return {
      enabled: false,
      helper: `Returns open once your order is delivered, and stay open for ${returnWindowDays} days after that.`,
    };
  }
  const closesAt = new Date(deliveredAt);
  closesAt.setDate(closesAt.getDate() + returnWindowDays);
  const format: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  if (Date.now() > closesAt.getTime()) {
    return {
      enabled: false,
      helper: `The ${returnWindowDays}-day return window for this order closed on ${closesAt.toLocaleDateString('en-GB', format)}.`,
    };
  }
  return { enabled: true, helper: `Returns close on ${closesAt.toLocaleDateString('en-GB', format)}.` };
}
