/**
 * The field, button and panel styles the three admin order dialogs share
 * (A14 Add tracking, A15 Cancel, A16 Refund). They are the same Form Field
 * (16:22) and Button (9:20) components in Figma, so a third hand-copied set
 * of inline styles would be a third place for them to drift — which is what
 * happened to the three ad-hoc status badges components/admin/status-badge
 * replaced.
 *
 * Note which border token the input uses: --mc-border-control (#767676), not
 * --mc-border-default. The Form Field component's own description is explicit
 * that a white control on a Paper ground has ~1.02:1 of fill contrast, so its
 * border is the only thing identifying it and WCAG 1.4.11 wants 3:1.
 */
export const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
};

export const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '1.44px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-primary)',
};

/** The smaller, muted section label the dialogs use above a select or a
 * panel ("REASON (REQUIRED)", "WHAT THIS DOES"). */
export const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  background: 'var(--mc-bg-surface)',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 72,
  lineHeight: '23px',
  resize: 'vertical',
};

export const helperStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
};

export const primaryButtonStyle: React.CSSProperties = {
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

/** What the Button component calls Disabled. It is never used without text
 * beside it saying what would enable it — the component's description makes
 * that a rule, not a suggestion. */
export const disabledButtonStyle: React.CSSProperties = {
  background: 'var(--mc-mist)',
  color: 'var(--mc-text-muted)',
  cursor: 'not-allowed',
};

export const ghostButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: 'none',
  color: 'var(--mc-text-primary)',
};

export const panelStyle: React.CSSProperties = {
  background: 'var(--mc-bg-page)',
  border: '1px solid var(--mc-border-default)',
  borderRadius: 'var(--mc-radius-md)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxSizing: 'border-box',
  width: '100%',
};

export const mutedSmallStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

export const ruleStyle: React.CSSProperties = {
  height: 1,
  width: '100%',
  background: 'var(--mc-border-default)',
};
