'use client';

import type { CSSProperties } from 'react';

/**
 * The real Quantity Control (Figma 24:25), shared by the bag page's lines
 * and the add-to-bag confirmation's own line.
 *
 * It lived inside app/(site)/bag/page.tsx while the bag was its only
 * consumer. 05G/H/I draws the SAME component inside the confirmation
 * panel, so a second hand-copy of the stepper would be the mistake
 * components/admin/status-badge.tsx was created to stop — three ad-hoc
 * copies that drift, with a change to one invisible to the others.
 *
 * The component's own description records what the states mean: "Quantity
 * is a text property so each bag line shows its own number; State covers
 * the minimum-reached case where decrement is disabled." Both targets are
 * 44px (rule 8), and the minus/plus are drawn as rects rather than typed
 * as "−"/"+" so they keep their weight at any font size.
 */
export const MAX_QTY = 10;

const stepStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

export function QuantityControl({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const canDecrease = quantity > 1;
  const canIncrease = quantity < MAX_QTY;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--mc-border-control)',
        borderRadius: 'var(--mc-radius-sm)',
      }}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrease}
        onClick={() => onChange(quantity - 1)}
        style={{
          ...stepStyle,
          cursor: canDecrease ? 'pointer' : 'not-allowed',
          color: canDecrease ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)',
        }}
      >
        <svg width="13" height="2" viewBox="0 0 13 2" aria-hidden>
          <rect width="13" height="1.25" fill="currentColor" />
        </svg>
      </button>
      <div style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>{quantity}</span>
      </div>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrease}
        onClick={() => onChange(quantity + 1)}
        style={{
          ...stepStyle,
          cursor: canIncrease ? 'pointer' : 'not-allowed',
          color: canIncrease ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
          <rect y="5.5" width="13" height="1.25" fill="currentColor" />
          <rect x="5.5" width="1.25" height="13" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
