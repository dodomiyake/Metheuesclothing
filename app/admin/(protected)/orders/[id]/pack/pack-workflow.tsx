'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPence } from '@/lib/money';
import type { FulfilmentStep } from '../fulfilment-steps';

/**
 * A13 Pack — Figma 139:2295 (Desktop) / 139:2116 (Tablet). There is no
 * Mobile frame, which is why the page wraps this in WideOnly.
 *
 * ONE breakpoint, like A12 and unlike A11: the two columns split at 1440 and
 * tablet stacks Main col above Side col in that order. Read off the frames,
 * not assumed.
 *
 * Why this is a client component end to end: the "Mark packed" button exists
 * TWICE in the design (top bar and the "what happens when you mark it
 * packed" panel) and both are gated on the same pick-line state, so the
 * top bar has to be inside the component that owns it.
 *
 * WHAT THE DESIGN DRAWS THAT IS NOT HERE, and why each one:
 *
 *  - "Rail A · shelf 3" / "Rail B · shelf 1" on every pick line. There is no
 *    warehouse location anywhere in the schema -- not on products, not on
 *    product_variants, not on order_items. A shelf reference is the single
 *    most checkable thing on this screen, so a made-up one is the worst
 *    possible invention: somebody walks to a rail that does not exist and
 *    then stops trusting the rest of the list. Omitted until a column backs
 *    it.
 *
 *  - "Correct mailer size -- 2 T-shirts, medium mailer". The count is real
 *    and stays; "medium mailer" is a packaging rule nothing in this system
 *    knows, so the line narrows to the part that is true.
 *
 *  - "Both T-shirts packed flat, not rolled" with "The customer asked for
 *    this in their checkout note". The design has read a note and turned it
 *    into an instruction. Nothing can do that, so this row appears only when
 *    orders.customer_note is actually set and quotes it verbatim instead of
 *    paraphrasing -- a paraphrase of a customer's instruction that drops a
 *    word is how the wrong thing gets packed.
 *
 *  - "Step 2 of 4". The subtitle says the real current state instead, from
 *    fulfilment_status, because a counter that does not move with the data
 *    is worse than no counter.
 *
 * THE SEAL CHECKLIST IS NOT PERSISTED and does not gate anything -- the
 * design's own helper says "Available once every PICK line is ticked", so
 * only the pick lines gate Mark packed. Both lists are a packing aid for one
 * session at the bench; there is no table behind either and inventing one to
 * store "returns slip included" would be storing a claim nobody verifies.
 * Refreshing clears them, which is the honest behaviour for state that was
 * never saved.
 *
 * The one action here is advance_fulfilment(packed) via POST
 * /api/admin/orders/[id]/fulfilment. That route also accepts 'processing',
 * which still has NO caller: A12's "Begin packing" is one of the actions
 * that screen deliberately omits, and A13 does not draw a start button
 * either. Marking packed straight from not_started is a legal forward jump,
 * so nothing is blocked by it -- but the queue cannot currently distinguish
 * "nobody has touched this" from "someone is picking it right now". Worth
 * settling with the design owner alongside the "To pack" label.
 */
export type Pick = {
  id: string;
  label: string;
  sku: string;
  quantity: number;
};

export function PackWorkflow({
  orderId,
  orderNumber,
  customer,
  itemCount,
  picks,
  steps,
  customerNote,
  deliveryMethod,
  addressLines,
  totalPence,
  statusLabel,
}: {
  orderId: string;
  orderNumber: string;
  customer: string;
  itemCount: number;
  picks: Pick[];
  steps: FulfilmentStep[];
  customerNote: string | null;
  deliveryMethod: string | null;
  addressLines: string[];
  totalPence: number;
  statusLabel: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sealed, setSealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = picks.filter((p) => !picked[p.id]).length;
  const canMarkPacked = picks.length > 0 && remaining === 0 && !saving;

  async function markPacked() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}/fulfilment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'packed' }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // advance_fulfilment names the order and its state; that message is
      // written for whoever is standing at the bench.
      setError(body.error ?? 'Could not mark this order packed. Please try again.');
      return;
    }
    router.push(`/admin/orders/${orderId}`);
    router.refresh();
  }

  const gateText = canMarkPacked
    ? 'Every pick line is ticked.'
    : picks.length === 0
      ? 'This order has no items to pick.'
      : `Available once every pick line is ticked. ${remaining} line${
          remaining === 1 ? '' : 's'
        } still to go.`;

  const markPackedButton = (full?: boolean) => (
    <button
      type="button"
      onClick={markPacked}
      disabled={!canMarkPacked}
      style={{
        ...primaryButtonStyle,
        ...(full ? { width: '100%' } : {}),
        ...(canMarkPacked
          ? {}
          : { background: 'var(--mc-mist)', color: 'var(--mc-text-muted)', cursor: 'not-allowed' }),
      }}
    >
      {saving ? 'Marking packed…' : 'Mark packed'}
    </button>
  );

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Pack order {orderNumber}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {statusLabel} — pick the exact variants · {customer} · {itemCount} item
            {itemCount === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {markPackedButton()}
          <Link href={`/admin/orders/${orderId}`} style={ghostButtonStyle}>
            Back to order
          </Link>
        </div>
      </div>

      <div className="mc-admin-content">
        <div className="mc-admin-order-layout mc-admin-pack-layout">
          <div className="mc-admin-order-main">
            <Panel heading="Where this order is">
              {steps.map((step) => (
                <div key={step.label} style={{ display: 'flex', gap: 12, padding: '4px 0' }}>
                  <span
                    aria-hidden
                    style={{
                      width: step.state === 'current' ? 14 : 10,
                      height: step.state === 'current' ? 14 : 10,
                      marginTop: 5,
                      flexShrink: 0,
                      borderRadius: '50%',
                      background: step.state === 'todo' ? 'transparent' : 'var(--mc-text-primary)',
                      border: step.state === 'todo' ? '1px solid var(--mc-border-control)' : 'none',
                    }}
                  />
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        margin: 0,
                        fontWeight: step.state === 'current' ? 600 : 500,
                        color: step.state === 'todo' ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
                      }}
                    >
                      {step.label}
                    </p>
                    <p style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </Panel>

            <Panel heading="Pick list — exact colour and size">
              {picks.length === 0 ? (
                <p style={mutedSmall}>
                  This order has no item lines. That should not happen for a paid order — check it
                  against Stripe before sending anything.
                </p>
              ) : (
                picks.map((pick, i) => (
                  <label
                    key={pick.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      minHeight: 44,
                      padding: i === 0 ? '11px 0 4px' : '14px 0 4px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--mc-border-default)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(picked[pick.id])}
                      onChange={(e) => setPicked((s) => ({ ...s, [pick.id]: e.target.checked }))}
                      style={checkboxStyle}
                    />
                    <span style={{ flex: '1 0 0', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, lineHeight: '22px' }}>{pick.label}</span>
                      <span style={{ display: 'block', fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
                        {pick.sku} · quantity {pick.quantity}
                      </span>
                    </span>
                  </label>
                ))
              )}
              <p style={mutedSmall}>
                Colour and size are the two things that get picked wrong. The SKU on the shelf label
                should match the SKU here character for character.
              </p>
            </Panel>

            <Panel heading="Before you seal it">
              {customerNote && (
                <SealRow
                  id="note"
                  label="Packed the way the customer asked"
                  description={`They wrote: “${customerNote}”`}
                  checked={Boolean(sealed.note)}
                  onChange={(v) => setSealed((s) => ({ ...s, note: v }))}
                />
              )}
              <SealRow
                id="slip"
                label="Returns slip included"
                checked={Boolean(sealed.slip)}
                onChange={(v) => setSealed((s) => ({ ...s, slip: v }))}
              />
              <SealRow
                id="mailer"
                label={`Correct mailer size — ${itemCount} T-shirt${itemCount === 1 ? '' : 's'}`}
                checked={Boolean(sealed.mailer)}
                onChange={(v) => setSealed((s) => ({ ...s, mailer: v }))}
              />
              <p style={mutedSmall}>
                These three are a bench aid for right now — nothing stores them and they do not gate
                Mark packed, which only the pick lines do.
              </p>
            </Panel>

            <Panel heading="What happens when you mark it packed" tinted>
              <p style={mutedSmall}>
                Marking packed does not tell the customer anything yet. The dispatch email goes out
                only when you add a carrier and tracking number on the next step — so a packed box
                sitting overnight never sends a shipping notice a day early.
              </p>
              {error && (
                <p role="alert" style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-status-error)', margin: 0 }}>
                  {error}
                </p>
              )}
              {markPackedButton(true)}
              {/* The Button component requires a disabled control to say what
                  would enable it. */}
              <p style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
                {gateText}
              </p>
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            <Panel heading="Order">
              <Field label="Order" value={orderNumber} />
              <Field label="Customer" value={customer} />
              {/* The design shows "Tracked 48 — DPD". The carrier is not known
                  until A14, and delivery_method is free text, so this is only
                  the service the customer chose. */}
              <Field label="Delivery" value={deliveryMethod || 'Not recorded'} />
              <Field
                label="Address"
                value={addressLines.length ? addressLines.join(', ') : 'No address on this order'}
              />
              <Field label="Total paid" value={formatPence(totalPence)} />
            </Panel>

            {customerNote && (
              <Panel heading="From the customer" tinted>
                <p style={{ fontSize: 14, lineHeight: '20px', margin: 0 }}>“{customerNote}”</p>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SealRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      key={id}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44, padding: '11px 0', cursor: 'pointer' }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={checkboxStyle} />
      <span style={{ flex: '1 0 0', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, lineHeight: '22px' }}>{label}</span>
        {description && (
          <span style={{ display: 'block', fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

function Panel({
  heading,
  tinted,
  children,
}: {
  heading?: string;
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
      }}
    >
      {heading && (
        <>
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
        </>
      )}
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

const checkboxStyle: React.CSSProperties = { width: 22, height: 22, flexShrink: 0, marginTop: 1 };

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  cursor: 'pointer',
};

const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  background: 'none',
  color: 'var(--mc-text-primary)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  textDecoration: 'none',
};
