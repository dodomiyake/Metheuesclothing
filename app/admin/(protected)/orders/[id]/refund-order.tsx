'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { formatPence, parsePounds } from '@/lib/money';
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
 * A16 Refund — Figma 141:1967 (Desktop) / 141:1791 (Tablet), both pulled.
 * Same dialog at 620 and 600; no Mobile frame.
 *
 * THE SCREEN NEEDED A TABLE UNDER IT. Before migration 012 the schema could
 * record that a refund had happened and nothing else: payment_status has
 * 'refunded' and 'partially_refunded' and there is no amount, no date, no
 * actor and no link to the Stripe object. A typed-amount confirmation on top
 * of that would have been theatre — the number the person types would have
 * been thrown away the moment it was used. `refunds` is what makes the
 * "HOW MUCH" choice mean anything, and what lets the second partial refund
 * know what the first one already sent.
 *
 * WHAT THE DESIGN DRAWS THAT IS NARROWED:
 *
 *  - "Refund part of it — CHOOSE LINES, or enter an amount". Enter an amount
 *    is built. Choosing lines is not: there is no line-level refund anywhere
 *    — `refunds` stores one amount per refund, and order_items has no
 *    refunded column. Drawing per-line tick boxes that silently collapse to
 *    a sum would claim a precision the record does not keep, so the option
 *    says what it actually is.
 *
 *  - "£284.00 returns to the Visa ending 4242". payments.card_brand and
 *    card_last4 are never written by the Stripe webhook, so the card cannot
 *    be named. Same narrowing as A15, E5, E8 and A12's omitted payment panel
 *    — one webhook change away from being true, and worth doing.
 *
 *  - "Jordan sees it in 5 to 10 working days depending on the bank" is kept
 *    as written: it is the bank's window, not a promise about our system.
 *
 * THE RESTOCK BOX STAYS OFF and that is the design's best idea on this
 * screen, repeated verbatim in its own description: refunding money and
 * putting goods back are separate events, often days apart, and conflating
 * them is how stock counts drift. A15 restocks automatically because a
 * cancelled order never left the building; this one cannot assume that.
 */
const REFUND_REASONS = [
  'Faulty or damaged on arrival',
  'Not as described',
  'Wrong item sent',
  'Arrived late',
  'Lost in transit',
  'Returned by the customer',
  'Goodwill',
  'Other',
];

export function RefundOrder({
  orderId,
  orderNumber,
  customer,
  itemCount,
  totalPence,
  alreadyRefundedPence,
  paymentLabel,
}: {
  orderId: string;
  orderNumber: string;
  customer: string;
  itemCount: number;
  totalPence: number;
  alreadyRefundedPence: number;
  paymentLabel: string;
}) {
  const router = useRouter();
  const headingId = useId();
  const remaining = Math.max(0, totalPence - alreadyRefundedPence);

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'all' | 'part'>('all');
  const [partial, setPartial] = useState('');
  const [restock, setRestock] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());

  // "Refund everything" means everything still owed, not the order total —
  // on an order that has already had a partial refund those are different
  // numbers, and record_refund would reject the larger one.
  const amountPence = scope === 'all' ? remaining : safePounds(partial);
  const amountValid = amountPence !== null && amountPence > 0 && amountPence <= remaining;
  // The typed confirmation is compared on the PARSED value, not the string,
  // so "284", "284.00" and "£284.00" all match and a stray space does not
  // read as a mismatch the person cannot see.
  const confirmPence = safePounds(confirm);
  const matches = amountValid && confirmPence !== null && confirmPence === amountPence;
  const canSubmit = amountValid && Boolean(reason) && matches && !saving;

  function openDialog() {
    setScope('all');
    setPartial('');
    setRestock(false);
    setReason('');
    setNote('');
    setConfirm('');
    setError(null);
    setKey(crypto.randomUUID());
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amountValid) return;
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_pence: amountPence,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
        restock,
        idempotency_key: key,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not send this refund. Please try again.');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={openDialog} style={ghostButtonStyle}>
        Refund
      </button>

      <ModalDialog open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 id={headingId} style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              Refund order {orderNumber}
            </h2>
            <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
              Refunds go back to the card that paid. They cannot be reversed — a refund sent by mistake
              has to be collected as a new order.
            </p>
          </div>

          <div aria-hidden style={ruleStyle} />

          <div style={{ ...panelStyle, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{orderNumber}</p>
              <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
                {customer} · {itemCount} item{itemCount === 1 ? '' : 's'} · {formatPence(totalPence)} paid
                {alreadyRefundedPence > 0 ? ` · ${formatPence(alreadyRefundedPence)} already refunded` : ''}
              </p>
            </div>
            <StatusBadge label={paymentLabel} tone={alreadyRefundedPence > 0 ? 'info' : 'success'} />
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ ...sectionLabelStyle, padding: 0 }}>How much</legend>
            <ScopeOption
              checked={scope === 'all'}
              onSelect={() => setScope('all')}
              title={alreadyRefundedPence > 0 ? 'Refund everything still owed' : 'Refund everything'}
              meta={
                alreadyRefundedPence > 0
                  ? `${formatPence(totalPence)} paid less ${formatPence(alreadyRefundedPence)} already refunded`
                  : 'Both lines and any delivery paid'
              }
              price={formatPence(remaining)}
            />
            <ScopeOption
              checked={scope === 'part'}
              onSelect={() => setScope('part')}
              title="Refund part of it"
              meta="Enter an amount. Refunding specific lines is not built — see this file's note."
              price=""
            />
            {scope === 'part' && (
              <label style={{ ...fieldStyle, paddingLeft: 2 }}>
                <span style={labelStyle}>Amount to refund</span>
                <input
                  inputMode="decimal"
                  value={partial}
                  onChange={(e) => setPartial(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  style={inputStyle}
                />
                <span style={helperStyle}>
                  In pounds. At most {formatPence(remaining)} is left to refund on this order.
                </span>
              </label>
            )}
          </fieldset>

          <label
            style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44, padding: '11px 0', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
              style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1 }}
            />
            <span style={{ flex: '1 0 0', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, lineHeight: '22px' }}>
                Put these items back into stock
              </span>
              <span style={{ display: 'block', fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
                Off by default. Tick it only when the goods are physically back on the shelf — refunding
                money and restocking are separate events and it is normal for one to happen days before
                the other.
              </span>
            </span>
          </label>

          <label style={fieldStyle}>
            <span style={sectionLabelStyle}>Reason (required)</span>
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, borderColor: 'var(--mc-border-strong)' }}
            >
              <option value="">Choose a reason…</option>
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={sectionLabelStyle}>Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{ ...textareaStyle, borderColor: 'var(--mc-border-strong)' }}
            />
            <span style={helperStyle}>Kept internally and shown in the audit log.</span>
          </label>

          <div style={{ ...panelStyle, background: 'var(--mc-bg-surface)' }}>
            <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {amountValid ? `${formatPence(amountPence!)} returns to the card that paid` : 'Enter an amount to refund'}
            </p>
            <p style={mutedSmallStyle}>
              {customer} sees it in 5 to 10 working days depending on the bank.{' '}
              {restock
                ? 'Stock is put back as part of this.'
                : 'Stock is left alone because the restock box is unticked.'}
            </p>
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Type the refund amount to confirm</span>
            <input
              inputMode="decimal"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              style={inputStyle}
            />
            <span style={helperStyle}>
              {amountValid
                ? `Type ${(amountPence! / 100).toFixed(2)} exactly.`
                : 'Choose how much to refund first.'}
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
              {saving ? 'Sending…' : amountValid ? `Refund ${formatPence(amountPence!)}` : 'Refund'}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={ghostButtonStyle}>
              Cancel
            </button>
          </div>

          {!canSubmit && !saving && (
            <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
              {!amountValid
                ? `Enter an amount between £0.01 and ${formatPence(remaining)}.`
                : !reason
                  ? 'Choose a reason, then type the amount to confirm.'
                  : `Type ${(amountPence! / 100).toFixed(2)} in the box above to confirm.`}
            </p>
          )}

          <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
            Recorded in the audit log as: you · the amount above · the reason above ·{' '}
            {restock ? 'stock restored' : 'stock not restored'} · today.
          </p>
        </form>
      </ModalDialog>
    </>
  );
}

/** The Selectable Option component (88:32). Its own description: "Selection
 * is marked by the control plus a border weight change, not colour alone." */
function ScopeOption({
  checked,
  onSelect,
  title,
  meta,
  price,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  meta: string;
  price: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: checked ? '15px 17px' : '16px 18px',
        background: 'var(--mc-bg-surface)',
        border: checked ? '2px solid var(--mc-border-strong)' : '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-sm)',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      <input
        type="radio"
        name="mc-refund-scope"
        checked={checked}
        onChange={onSelect}
        style={{ width: 20, height: 20, flexShrink: 0 }}
      />
      <span style={{ flex: '1 0 0', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
          {meta}
        </span>
      </span>
      {price && <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap' }}>{price}</span>}
    </label>
  );
}

/** parsePounds throws on anything unparseable; a half-typed amount is the
 * normal state of this field, not an error worth surfacing. */
function safePounds(input: string): number | null {
  try {
    const pence = parsePounds(input);
    return Number.isFinite(pence) ? pence : null;
  } catch {
    return null;
  }
}
