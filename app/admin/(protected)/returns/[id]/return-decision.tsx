'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPence } from '@/lib/money';
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
  mutedSmallStyle,
  ruleStyle,
} from '../../orders/[id]/dialog-styles';

/**
 * A18's three actions, and the per-item condition they record.
 *
 * CONDITION AND RESTOCK ARE PER ITEM. That is the screen's own stated idea —
 * "one T-shirt can go back on the shelf while the other does not" — and it
 * is why `return_items` has `condition` and `restock` columns rather than
 * `returns` having one of each.
 *
 * APPROVING REQUIRES THE PARCEL TO BE HERE, which is a departure. The frames
 * draw Approve as enabled while the badge still reads "On its way to us",
 * but approval applies the restock, and putting stock back for a parcel
 * nobody has opened is how the shop sells a T-shirt that is still in a van.
 * The design's own Refund panel already says "available once the parcel is
 * marked received and checked"; this applies the same bar one step earlier,
 * where the stock actually moves. decide_return enforces it, so this is the
 * UI agreeing with the function rather than a second copy of the rule.
 *
 * MARK RECEIVED is not drawn anywhere, and without it nothing could ever be
 * approved: `received` is a real return_status with a real received_at
 * column and A18's progress list has a "Checked at the atelier" step, but no
 * screen in the file sets it. Added rather than left as a hole.
 *
 * The condition options are defined here, not in the database —
 * return_items.condition is free text. Same honesty as A15's reason list.
 */
const CONDITIONS = [
  'Unworn, tags attached',
  'Unworn, tags removed',
  'Worn',
  'Washed',
  'Marked or soiled',
  'Damaged',
  'Wrong item sent back',
  'Not checked yet',
];

const REJECTION_REASONS = [
  'Outside the returns window',
  'Worn or washed',
  'Tags removed',
  'Marked, soiled or damaged after delivery',
  'Not the item that was sent',
  'Nothing arrived',
];

export type DecisionItem = {
  id: string;
  label: string;
  sku: string;
  quantity: number;
  linePence: number;
  customerReason: string;
  condition: string | null;
  restock: boolean;
};

export function ReturnDecision({
  returnId,
  returnNumber,
  status,
  items,
  refundablePence,
  alreadyRefundedPence,
  deliveryPence,
  eligibility,
  progress,
  customerNote,
  customer,
}: {
  returnId: string;
  returnNumber: string;
  status: string;
  items: DecisionItem[];
  refundablePence: number;
  alreadyRefundedPence: number;
  deliveryPence: number;
  /* Server-rendered panels. This component owns the two columns because the
     design splits the ONE piece of shared state across both: Items and
     condition sits in the main column while the Approve button that applies
     it sits in the side one. Read off 144:2278, and the tablet frame
     (144:2056) confirms they stack in that order below 1440. */
  eligibility: React.ReactNode;
  progress: React.ReactNode;
  customerNote: React.ReactNode;
  customer: React.ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      items.map((i) => [i.id, { condition: i.condition ?? '', restock: i.restock }]),
    ),
  );
  const [rejectReason, setRejectReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(() => (refundablePence / 100).toFixed(2));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());

  const decided = status === 'approved' || status === 'rejected' || status === 'refunded';
  const received = status === 'received';

  async function post(path: string, body: unknown, label: string) {
    setError(null);
    setBusy(label);
    const res = await fetch(`/api/admin/returns/${returnId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      // The functions' own messages name the return and say what would make
      // the call legal.
      setError(payload.error ?? 'That did not work. Please try again.');
      return false;
    }
    setKey(crypto.randomUUID());
    router.refresh();
    return true;
  }

  const itemPayload = () =>
    items.map((i) => ({
      return_item_id: i.id,
      ...(rows[i.id].condition ? { condition: rows[i.id].condition } : {}),
      restock: rows[i.id].restock,
    }));

  const refundPence = Math.round(Number.parseFloat(refundAmount.replace(/[^0-9.]/g, '')) * 100);
  const refundValid =
    Number.isFinite(refundPence) && refundPence > 0 && refundPence <= refundablePence;

  return (
    <div className="mc-admin-order-layout mc-admin-pack-layout">
      <div className="mc-admin-order-main">
      {eligibility}
      <Panel heading="Items and condition">
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              borderTop: i === 0 ? 'none' : '1px solid var(--mc-border-default)',
              paddingTop: i === 0 ? 0 : 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* No product photography exists (README's blocked-on-owner
                  list), so this is the same honest well the rest of the admin
                  uses rather than a broken <img>. */}
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
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
                  {item.sku}
                  {item.quantity > 1 ? ` · ${item.quantity} units` : ''} · customer says:{' '}
                  {item.customerReason}
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>
                {formatPence(item.linePence)}
              </p>
            </div>

            <label style={fieldStyle}>
              <span style={sectionLabelStyle}>Condition when it arrives</span>
              <select
                value={rows[item.id].condition}
                disabled={decided}
                onChange={(e) =>
                  setRows((s) => ({ ...s, [item.id]: { ...s[item.id], condition: e.target.value } }))
                }
                style={{ ...inputStyle, borderColor: 'var(--mc-border-strong)' }}
              >
                <option value="">Not recorded</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                minHeight: 44,
                padding: '11px 0',
                cursor: decided ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={rows[item.id].restock}
                disabled={decided}
                onChange={(e) =>
                  setRows((s) => ({ ...s, [item.id]: { ...s[item.id], restock: e.target.checked } }))
                }
                style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ flex: '1 0 0', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, lineHeight: '22px' }}>
                  Put this one back into stock
                </span>
                <span style={{ display: 'block', fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
                  {rows[item.id].condition
                    ? `Recorded as: ${rows[item.id].condition}.`
                    : 'Decide once you have seen it.'}
                </span>
              </span>
            </label>
          </div>
        ))}
        <p style={mutedSmallStyle}>
          Condition and the restock decision are recorded per item, not per return — one T-shirt can go
          back on the shelf while the other does not. Both are applied when you approve, and a
          rejection never restocks anything.
        </p>
      </Panel>
      {progress}
      {customerNote}
      </div>

      <div className="mc-admin-order-side">
      <Panel heading="Decision">
        {error && (
          <p role="alert" style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-status-error)', margin: 0, lineHeight: '21px' }}>
            {error}
          </p>
        )}

        {decided ? (
          <p style={mutedSmallStyle}>
            This return has already been decided. Conditions and restock choices are frozen as they
            were at the time.
          </p>
        ) : (
          <>
            <p style={mutedSmallStyle}>
              Approving does not move any money. It confirms the return is accepted, records the
              condition, and applies the restock choices above. The refund is a separate, deliberate
              step.
            </p>

            {!received && (
              <>
                <button
                  type="button"
                  onClick={() => post('receive', {}, 'receive')}
                  disabled={busy !== null}
                  style={{ ...primaryButtonStyle, width: '100%' }}
                >
                  {busy === 'receive' ? 'Marking…' : 'Mark the parcel received'}
                </button>
                <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
                  Approving puts stock back, so the parcel has to be here first. This step is not on
                  the design; without it nothing could ever be approved.
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => post('decide', { approve: true, items: itemPayload() }, 'approve')}
              disabled={!received || busy !== null}
              style={{
                ...primaryButtonStyle,
                width: '100%',
                ...(received && busy === null ? {} : disabledButtonStyle),
              }}
            >
              {busy === 'approve' ? 'Approving…' : 'Approve return'}
            </button>
            {/* The Button component requires a disabled control to say what
                would enable it. */}
            {!received && (
              <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
                Available once the parcel is marked received.
              </p>
            )}

            <div aria-hidden style={ruleStyle} />

            <label style={fieldStyle}>
              <span style={sectionLabelStyle}>Rejection reason</span>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ ...inputStyle, borderColor: 'var(--mc-border-strong)' }}
              >
                <option value="">Choose a reason…</option>
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span style={helperStyle}>
                Required if you reject. The customer is emailed this reason in plain language, word
                for word — there is no second draft between here and their inbox.
              </span>
            </label>

            <button
              type="button"
              onClick={() =>
                post('decide', { approve: false, reason: rejectReason, items: itemPayload() }, 'reject')
              }
              disabled={!rejectReason || busy !== null}
              style={{
                ...ghostButtonStyle,
                width: '100%',
                border: '1px solid var(--mc-border-strong)',
                ...(rejectReason && busy === null ? {} : { color: 'var(--mc-text-muted)', cursor: 'not-allowed' }),
              }}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject return'}
            </button>
            {!rejectReason && (
              <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
                Available once a reason is chosen.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel heading="Refund" tinted>
        <Row label="Items" value={formatPence(refundablePence + alreadyRefundedPence)} />
        {/* The design's "Return postage — Free, drop-off" is not reproduced:
            nothing in this system issues a label, charges for one or records
            how the parcel travelled. */}
        <Row
          label="Delivery paid on the order"
          value={deliveryPence === 0 ? 'Free' : `${formatPence(deliveryPence)} — not refunded`}
        />
        {alreadyRefundedPence > 0 && (
          <Row label="Already refunded on this order" value={formatPence(alreadyRefundedPence)} />
        )}
        <Row label="Left to refund" value={formatPence(refundablePence)} strong />

        {status === 'refunded' ? (
          <p style={mutedSmallStyle}>This return has been refunded.</p>
        ) : status === 'rejected' ? (
          <p style={mutedSmallStyle}>
            This return was rejected, so there is nothing to refund. The customer has been emailed the
            reason.
          </p>
        ) : status !== 'approved' ? (
          <p style={mutedSmallStyle}>
            Nothing has been refunded yet. Available once the return is approved — approving is what
            records the condition and puts the stock back.
          </p>
        ) : (
          <>
            <label style={fieldStyle}>
              <span style={labelStyle}>Amount to refund</span>
              <input
                inputMode="decimal"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                style={inputStyle}
              />
              <span style={helperStyle}>
                In pounds. At most {formatPence(refundablePence)} is left on this order.
              </span>
            </label>
            <label style={fieldStyle}>
              <span style={sectionLabelStyle}>Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{ ...textareaStyle, borderColor: 'var(--mc-border-strong)' }}
              />
              <span style={helperStyle}>Kept internally and shown in the audit log.</span>
            </label>
            <button
              type="button"
              onClick={() =>
                post(
                  'refund',
                  {
                    amount_pence: refundPence,
                    reason: `Return ${returnNumber} approved`,
                    ...(note.trim() ? { note: note.trim() } : {}),
                    idempotency_key: key,
                  },
                  'refund',
                )
              }
              disabled={!refundValid || busy !== null}
              style={{
                ...primaryButtonStyle,
                width: '100%',
                ...(refundValid && busy === null ? {} : disabledButtonStyle),
              }}
            >
              {busy === 'refund'
                ? 'Sending…'
                : refundValid
                  ? `Refund ${formatPence(refundPence)}`
                  : 'Refund'}
            </button>
            {!refundValid && (
              <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
                Enter an amount between £0.01 and {formatPence(refundablePence)}.
              </p>
            )}
            <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
              This sends the money and emails the customer. Stock is not touched — that was decided
              per item when you approved.
            </p>
          </>
        )}
      </Panel>
      {customer}
      </div>
    </div>
  );
}

function Panel({
  heading,
  tinted,
  children,
}: {
  heading: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: tinted ? 'var(--mc-bg-page)' : 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <h2 style={sectionLabelStyle}>{heading}</h2>
      <div aria-hidden style={ruleStyle} />
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 14, fontWeight: strong ? 600 : 500 }}>{value}</span>
    </div>
  );
}
