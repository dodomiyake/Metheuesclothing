'use client';

import { useState } from 'react';
import {
  ReturnRequestForm,
  returnGate,
  type ReturnableItem,
} from '@/components/site/return-request';

/**
 * 13 Order Detail's "Need something else?" rail card (103:3736).
 *
 * THE DESIGN'S THREE ACTIONS BECOME ONE REAL ONE AND TWO HONEST LINES.
 * Start a return is real — it posts to /api/returns, the same endpoint
 * track-order uses, and request_return() applies the window. "Cancel this
 * order" is not: cancelling issues a Stripe refund and lives in A15, which
 * is staff only, so rather than a button that cannot act this says who to
 * ask and when it is still possible. "Contact us about this order" goes to
 * the real contact_email from store_settings, because nothing in this app
 * sends staff email and /contact does not exist.
 */
export function OrderReturnPanel({
  orderNumber,
  email,
  paymentStatus,
  deliveredAt,
  returnWindowDays,
  items,
  existingReturns,
  contactEmail,
  cancellable,
}: {
  orderNumber: string;
  email: string;
  paymentStatus: string;
  deliveredAt: string | null;
  returnWindowDays: number;
  items: ReturnableItem[];
  existingReturns: { return_number: string; status: string }[];
  contactEmail: string;
  cancellable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const gate = returnGate({ paymentStatus, deliveredAt, returnWindowDays });

  return (
    <section
      id="return"
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 4,
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: '0 0 14px',
        }}
      >
        Need something else?
      </h2>

      {existingReturns.length > 0 && (
        <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6 }}>
          {existingReturns.map((r) => `${r.return_number} (${r.status.replace(/_/g, ' ')})`).join(', ')}{' '}
          — see{' '}
          <a href="/account/returns" style={{ color: 'var(--mc-text-primary)', fontWeight: 600 }}>
            your returns
          </a>
          .
        </p>
      )}

      <button
        type="button"
        disabled={!gate.enabled}
        onClick={() => setOpen(true)}
        className="mc-button-secondary"
        style={{
          width: '100%',
          background: 'none',
          cursor: gate.enabled ? 'pointer' : 'not-allowed',
          opacity: gate.enabled ? 1 : 0.5,
          borderColor: gate.enabled ? 'var(--mc-border-strong)' : 'var(--mc-border-control)',
        }}
      >
        Start a return
      </button>
      <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--mc-text-muted)' }}>
        {gate.helper}
      </p>

      <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--mc-text-muted)' }}>
        {cancellable
          ? 'Need this order cancelled? Email us before it is dispatched and we will stop it and refund you.'
          : 'This order can no longer be cancelled — once it is on its way, a return is the way back.'}
      </p>

      <p style={{ margin: '12px 0 0' }}>
        <a
          href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Order ${orderNumber}`)}`}
          className="mc-button-ghost"
          style={{ paddingLeft: 0 }}
        >
          Contact us about this order
        </a>
      </p>

      {open && gate.enabled && (
        <div style={{ marginTop: 16 }}>
          <ReturnRequestForm orderNumber={orderNumber} email={email} items={items} />
        </div>
      )}
    </section>
  );
}
