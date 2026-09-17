/**
 * Metheues Clothings — design tokens
 * Generated from Figma file 9SzUlTWGVKOCkAULkbqOsr, 12 September 2026;
 * recoloured cool on 17 September 2026.
 * Mirrors tokens.css. Keep the two in step.
 */

export const primitive = {
  ink: '#0F1318',
  graphite: '#1E2630',
  bone: '#F3F6F8',
  chalk: '#FFFFFF',
  mist: '#D5DBE1',
  slate: '#5A646E',
  slateOnDark: '#97A2AD',
  ultramarine: '#2B3FD9',
  ultramarineOnDark: '#7C8CFF',
  teal: '#10695F',
  ember: '#AD3A0B',
  crimson: '#C81E3C',
} as const;

export const color = {
  bg: { page: primitive.bone, surface: primitive.chalk, inverse: primitive.ink },
  text: {
    primary: primitive.ink,
    muted: primitive.slate,
    inverse: primitive.chalk,
    /** Supporting text on dark grounds. primitive.slate fails AA there (2.6:1). */
    mutedInverse: primitive.slateOnDark,
  },
  border: { default: primitive.mist, strong: primitive.ink },
  action: { primaryBg: primitive.ink, primaryText: primitive.chalk },
  focus: { ring: primitive.ink },
  status: {
    success: primitive.teal,
    /** Low stock, awaiting review, pending. Never the accent. */
    attention: primitive.ember,
    error: primitive.crimson,
  },
  /** Brand accent only — never focus, warning or selection (MVP §6). */
  accent: primitive.ultramarine,
  /** The accent on ink or graphite; the pale-ground one is 2.4:1 there. */
  accentOnDark: primitive.ultramarineOnDark,
  /** Type sitting ON an accent ground (announcement bar, newsletter action). */
  accentText: primitive.chalk,
} as const;

export const space = { '2xs': 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 } as const;
export const radius = { none: 0, sm: 2, md: 4, lg: 8 } as const;
export const breakpoint = { mobile: 390, tablet: 768, desktop: 1440 } as const;
export const gutter = { mobile: 20, tablet: 32, desktop: 48 } as const;

export const font = {
  display: '"Bodoni Moda", Didot, "Times New Roman", serif',
  body: '"Manrope", ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
} as const;

export const type = {
  /** The one role that changes with viewport. tokens.css declares it
   * mobile-first and steps it up at 768/1440; these are the same numbers. */
  pageTitle: { size: 34, tabletSize: 42, desktopSize: 52, font: font.display, weight: 400 },
  section:   { size: 26, font: font.display, weight: 400 },
  cardTitle: { size: 20, font: font.body, weight: 600 },
  subhead:   { size: 17, font: font.body, weight: 600 },
  bodyLead:  { size: 16, font: font.body, weight: 400 },
  body:      { size: 15, font: font.body, weight: 400 },
  meta:      { size: 13, font: font.body, weight: 400 },
  caption:   { size: 12, font: font.body, weight: 400 },
  label:     { size: 11, font: font.body, weight: 600, uppercase: true, tracking: 1.3 },
  tag:       { size: 10, font: font.body, weight: 600, uppercase: true, tracking: 1.1 },
} as const;

/** Every interactive target, no exceptions. */
export const touchMin = 44;
