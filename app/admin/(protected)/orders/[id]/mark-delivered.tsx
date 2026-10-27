'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  fieldStyle,
  sectionLabelStyle,
  inputStyle,
  helperStyle,
  primaryButtonStyle,
  disabledButtonStyle,
  mutedSmallStyle,
} from '@/components/admin/dialog-styles';

/**
 * "Mark delivered" — the step that finishes fulfilment.
 *
 * NO FRAME DRAWS THIS. It is here for the same reason A18 gained "Mark
 * received": without it nothing downstream could happen. Migration 024 has
 * the finding — `fulfilments.delivered_at` was read in nine places and
 * written by nothing, and `delivered` was a value in the enum that no code
 * path could produce, because advance_fulfilment refuses anything but the
 * packing steps and ship_order stops at shipped.
 *
 * INLINE RATHER THAN A DIALOG, unlike A14 beside it and A15/A16. The
 * consequence-list-and-typed-confirmation pattern exists for actions that
 * cannot be undone — a refund, a cancellation, an erasure. This one is a
 * record of something that already happened in the real world, and if the
 * date is wrong a person can say so. A modal with a consequence list would
 * be borrowing weight it does not carry, which is its own kind of
 * dishonesty about which actions are dangerous.
 *
 * IT STILL NAMES THE ONE CONSEQUENCE THAT MATTERS. The returns window runs
 * from this date, so marking an order delivered starts a clock the customer
 * is owed. That is why the date is editable at all: staff hear about a
 * delivery after it happens, and 024 accepts a past date for exactly this.
 */
export function MarkDelivered({
  orderId,
  orderNumber,
  returnWindowDays,
}: {
  orderId: string;
  orderNumber: string;
  returnWindowDays: number;
}) {
  const router = useRouter();
  const dateId = useId();
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No future dates in the picker either. 024 refuses one, and a control
  // that offers what the server rejects is a control that wastes a click.
  const today = new Date().toISOString().slice(0, 10);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(when ? { delivered_on: when } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not mark this order delivered.');
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      <label style={fieldStyle} htmlFor={dateId}>
        <span style={sectionLabelStyle}>Arrived on</span>
        <input
          id={dateId}
          type="date"
          value={when}
          max={today}
          onChange={(e) => setWhen(e.target.value)}
          style={inputStyle}
        />
        <span style={helperStyle}>
          Leave this blank if it arrived today. Put the real date in if the carrier says it landed
          earlier — the {returnWindowDays}-day returns window runs from this date, so an
          approximate guess costs {orderNumber ? 'this customer' : 'the customer'} days they are
          owed.
        </span>
      </label>

      {error && (
        <p
          role="alert"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-status-error)', margin: 0, lineHeight: '21px' }}
        >
          {error}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{ ...primaryButtonStyle, ...(saving ? disabledButtonStyle : {}) }}
        >
          {saving ? 'Saving…' : 'Mark delivered'}
        </button>
      </div>

      <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
        Recorded in the audit log as: you · order delivered · the date above. No email is sent —
        there is no delivery confirmation template in the design, which is a question for the
        design owner rather than something to invent here.
      </p>
    </div>
  );
}
