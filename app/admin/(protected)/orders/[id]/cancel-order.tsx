'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { formatPence } from '@/lib/money';
import { StatusBadge } from '@/components/admin/status-badge';
import { ModalDialog } from '@/components/admin/modal-dialog';
import {
  fieldStyle,
  labelStyle,
  sectionLabelStyle,
  inputStyle,
  textareaStyle,
  helperStyle,
  primaryButtonStyle,
  disabledButtonStyle,
  ghostButtonStyle,
  panelStyle,
  mutedSmallStyle,
  ruleStyle,
} from './dialog-styles';

/**
 * A15 Cancel order — Figma 141:1910 (Desktop) / 141:1734 (Tablet). Both
 * pulled; they are the same dialog at 620 and 600, with identical content.
 * No Mobile frame, like every other consequential admin action.
 *
 * The Button component's description says there is deliberately no
 * destructive style here: "cancel and refund rely on a consequence list and
 * a typed confirmation instead". Both are reproduced exactly — the four
 * consequences and the type-the-order-number gate are the safety mechanism,
 * so weakening either to save a step would remove the only thing standing
 * between a mis-click and an irreversible refund.
 *
 * THE CONSEQUENCE LIST IS COMPUTED, NOT COPIED. The design's four lines name
 * £284.00, a Visa ending 4242, 4 units and two SKUs. Three of those come
 * from real data and are rendered from it. The fourth does not:
 *
 *  - "refunded to the Visa ending 4242" → "back to the card that paid".
 *    payments.card_brand and card_last4 exist and the Stripe webhook never
 *    writes them, so naming a card would mean printing nulls or inventing a
 *    brand. Same narrowing as E5 and A12's omitted payment-method panel.
 *
 * Two lines change shape with the order rather than being fixed text, which
 * the drawn version cannot show: an UNPAID order has nothing to refund and
 * says so instead of promising money back, and the restock line counts the
 * real order_items rather than a hardcoded 4.
 *
 * "Stripe does not return its processing fee" is kept. It is true, it costs
 * the business real money, and it is exactly the sort of thing someone
 * cancelling their fifth order of the day should be reminded of.
 */
const CANCEL_REASONS = [
  'Customer changed their mind',
  'Customer asked us to cancel',
  'Out of stock',
  'Duplicate order',
  'Problem with the delivery address',
  'Suspected fraud',
  'Priced or listed wrongly',
  'Other',
];

export function CancelOrder({
  orderId,
  orderNumber,
  customer,
  itemCount,
  unitCount,
  totalPence,
  paymentStatus,
  paymentLabel,
  skuSummary,
}: {
  orderId: string;
  orderNumber: string;
  customer: string;
  itemCount: number;
  unitCount: number;
  totalPence: number;
  paymentStatus: string;
  paymentLabel: string;
  skuSummary: string;
}) {
  const router = useRouter();
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Generated once per dialog opening and sent with every attempt, so a
  // retry after a timeout returns Stripe's original refund instead of
  // issuing a second one. See the route's idempotency note.
  const [key, setKey] = useState(() => crypto.randomUUID());

  const paid = paymentStatus === 'paid';
  const matches = confirm.trim().toUpperCase() === orderNumber.toUpperCase();
  const canSubmit = Boolean(reason) && matches && !saving;

  function openDialog() {
    setReason('');
    setNote('');
    setConfirm('');
    setError(null);
    setKey(crypto.randomUUID());
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
        idempotency_key: key,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not cancel this order. Please try again.');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={openDialog} style={ghostButtonStyle}>
        Cancel order
      </button>

      <ModalDialog open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 id={headingId} style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              Cancel order {orderNumber}?
            </h2>
            <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
              This cannot be undone. A cancelled order stays in the list as a record, but it cannot be
              reopened or shipped afterwards.
            </p>
          </div>

          <div aria-hidden style={ruleStyle} />

          <div style={{ ...panelStyle, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{orderNumber}</p>
              <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
                {customer} · {itemCount} item{itemCount === 1 ? '' : 's'} · {formatPence(totalPence)}{' '}
                {paid ? 'paid' : paymentStatus}
              </p>
            </div>
            <StatusBadge label={paymentLabel} tone={paid ? 'success' : 'neutral'} />
          </div>

          <div style={panelStyle}>
            <p style={sectionLabelStyle}>What this does</p>
            <div aria-hidden style={ruleStyle} />
            <Consequence tone="var(--mc-status-error)">
              {paid ? (
                <>
                  {formatPence(totalPence)} is refunded to the card that paid. Stripe does not return its
                  processing fee.
                </>
              ) : (
                <>
                  Nothing is refunded — this order was never paid for, so no money was taken.
                </>
              )}
            </Consequence>
            <Consequence tone="var(--mc-status-success)">
              {unitCount} unit{unitCount === 1 ? '' : 's'} go back into stock
              {skuSummary ? `: ${skuSummary}` : ''}.
            </Consequence>
            <Consequence tone="var(--mc-text-muted)">
              {customer} is emailed to say the order is cancelled
              {paid ? ' and the money is on its way back' : ''}.
            </Consequence>
            <Consequence tone="var(--mc-text-muted)">
              The order moves to Cancelled and can no longer be picked, packed or shipped.
            </Consequence>
          </div>

          <label style={fieldStyle}>
            <span style={sectionLabelStyle}>Reason (required)</span>
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, borderColor: 'var(--mc-border-strong)' }}
            >
              <option value="">Choose a reason…</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span style={helperStyle}>
              The customer never sees this. It is here so the pattern is visible when you look back at a
              month of cancellations. The list lives in this file — there is no reasons table.
            </span>
          </label>

          <label style={fieldStyle}>
            <span style={sectionLabelStyle}>Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{ ...textareaStyle, borderColor: 'var(--mc-border-strong)' }}
            />
            <span style={helperStyle}>Optional. Kept internally and shown in the audit log.</span>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Type the order number to confirm</span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
            />
            <span style={helperStyle}>
              Type {orderNumber} exactly. This step exists because cancelling is not reversible.
            </span>
          </label>

          {error && (
            <p role="alert" style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-status-error)', margin: 0, lineHeight: '21px' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{ ...primaryButtonStyle, ...(canSubmit ? {} : disabledButtonStyle) }}
            >
              {saving ? 'Cancelling…' : 'Cancel this order'}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={ghostButtonStyle}>
              Keep the order
            </button>
          </div>

          {/* The Button component requires a disabled control to say what
              would enable it. */}
          {!canSubmit && !saving && (
            <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
              {!reason
                ? 'Choose a reason, then type the order number to confirm.'
                : `Type ${orderNumber} in the box above to confirm.`}
            </p>
          )}

          <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
            Recorded in the audit log as: you · order cancelled · the reason above
            {paid ? ` · ${formatPence(totalPence)} refunded` : ''} · lines restocked · today.
          </p>
        </form>
      </ModalDialog>
    </>
  );
}

/** A bullet whose colour supports the sentence rather than carrying it —
 * rule 8, and the Status Badge component's own "the word carries the
 * meaning". Each line reads correctly with the dot removed. */
function Consequence({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span aria-hidden style={{ width: 5, height: 5, marginTop: 7, borderRadius: '50%', background: tone, flexShrink: 0 }} />
      <p style={{ flex: '1 0 0', minWidth: 0, fontSize: 13, lineHeight: '20px', margin: 0 }}>{children}</p>
    </div>
  );
}
