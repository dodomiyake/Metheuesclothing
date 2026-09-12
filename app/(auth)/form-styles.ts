import type { CSSProperties } from 'react';

/**
 * Shared across the four auth forms so the 44px touch-target rule (§8 in
 * CLAUDE.md — "interactive targets are 44px minimum") is set once, not
 * copied into four files where one could quietly drift under it.
 */
export const fieldStyle: CSSProperties = {
  display: 'block',
  marginBottom: 'var(--mc-space-md)',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--mc-type-label)',
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
  marginBottom: 'var(--mc-space-2xs)',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--mc-border-default)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  boxSizing: 'border-box',
};

export const buttonStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  fontWeight: 600,
  cursor: 'pointer',
};

export const titleStyle: CSSProperties = {
  fontFamily: 'var(--mc-font-display)',
  fontSize: 'var(--mc-type-section)',
  marginTop: 0,
};

export const errorStyle: CSSProperties = {
  color: 'var(--mc-status-error)',
  fontSize: 'var(--mc-type-body)',
};
