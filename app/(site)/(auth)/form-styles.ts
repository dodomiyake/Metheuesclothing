import type { CSSProperties } from 'react';

/**
 * Matches Figma's Form Field / Button components (nodes 16:22 / 9:20, file
 * 9SzUlTWGVKOCkAULkbqOsr) and the auth screens' head/divider/small-print
 * treatment (e.g. 95:2620 Sign In) — shared across the four auth pages so
 * one file drifting out of sync with the design isn't a risk in four places.
 */
export const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '1.44px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-primary)',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '14px 16px',
  background: 'var(--mc-bg-surface)',
  border: '1px solid var(--mc-border-default)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

export const helperStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const buttonBase: CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '14px 24px',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  cursor: 'pointer',
  boxSizing: 'border-box',
};

export const buttonStyle: CSSProperties = {
  ...buttonBase,
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
};

export const secondaryButtonStyle: CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  color: 'var(--mc-text-primary)',
  border: '1px solid var(--mc-border-strong)',
};

export const ghostButtonStyle: CSSProperties = {
  ...buttonBase,
  width: 'auto',
  background: 'transparent',
  color: 'var(--mc-text-primary)',
  border: 'none',
  padding: '14px 24px',
};

export const disabledSecondaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: '1px solid var(--mc-border-default)',
  color: 'var(--mc-text-muted)',
  cursor: 'not-allowed',
};

export const headStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export const titleStyle: CSSProperties = {
  fontFamily: 'var(--mc-font-display)',
  fontSize: 48,
  lineHeight: 1.1,
  color: 'var(--mc-text-primary)',
  margin: 0,
};

export const subtextStyle: CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  lineHeight: 1.6,
  color: 'var(--mc-text-muted)',
  margin: 0,
};

export const dividerStyle: CSSProperties = {
  borderTop: '1px solid var(--mc-border-default)',
  paddingTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export const smallPrintStyle: CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 12,
  lineHeight: 1.6,
  color: 'var(--mc-text-muted)',
  margin: 0,
};

export const errorStyle: CSSProperties = {
  color: 'var(--mc-status-error)',
  fontSize: 14,
  margin: 0,
};
