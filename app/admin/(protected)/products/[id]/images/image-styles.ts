/**
 * The shared look of A05's controls.
 *
 * Lifted out of image-manager.tsx when pixabay-search.tsx became the
 * second consumer — the same move `components/admin/dialog-styles.ts` and
 * `app/(site)/form-styles.ts` record. A second hand-copy of a control's
 * styling is exactly what components/admin/status-badge.tsx was created
 * to stop: five hardcoded hexes survived two palette changes because a
 * raw value is invisible to a token change.
 *
 * Every value here is a token. `--mc-border-control` on the inputs rather
 * than `--mc-border-default` is rule 8's second correction, not a
 * preference: on a tinted ground a white control has about 1.02:1 of fill
 * contrast, so its border is the only thing identifying it as a control
 * and WCAG 1.4.11 wants 3:1 of that. `minHeight: 44` on buttonBase is the
 * same rule's touch-target floor.
 */
import type React from 'react';

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  background: 'var(--mc-bg-surface)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

export const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

export const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

export const primaryButton = (busy: boolean): React.CSSProperties => ({
  ...buttonBase,
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  cursor: busy ? 'default' : 'pointer',
  whiteSpace: 'nowrap',
});

export const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--mc-border-strong)',
  background: 'none',
  color: 'var(--mc-text-primary)',
  cursor: 'pointer',
};

export const ghostButton: React.CSSProperties = { ...buttonBase, color: 'var(--mc-text-primary)' };
