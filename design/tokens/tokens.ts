/**
 * Metheues Clothings — design tokens
 * Generated from Figma file 9SzUlTWGVKOCkAULkbqOsr, 12 September 2026;
 * recoloured cool on 17 September and stark on 21 September 2026.
 * Mirrors tokens.css. Keep the two in step.
 */

export const primitive = {
  ink: '#0A0A0A',
  graphite: '#191919',
  paper: '#FAFAFA',
  chalk: '#FFFFFF',
  /** Decorative hairlines and image wells only — 1.26:1, never a control edge. */
  mist: '#E0E0E0',
  /** Control boundaries. 4.35:1 on paper, which WCAG 1.4.11 requires. */
  steel: '#767676',
  slate: '#5F5F5F',
  slateOnDark: '#A3A3A3',
  /** Brand accent. A GROUND on pale surfaces — 1.26:1 as text there. */
  acid: '#D8F34A',
  teal: '#0F6152',
  ember: '#A33C0A',
  crimson: '#C4142F',
} as const;

export const color = {
  bg: { page: primitive.paper, surface: primitive.chalk, inverse: primitive.ink },
  text: {
    primary: primitive.ink,
    muted: primitive.slate,
    inverse: primitive.chalk,
    /** Supporting text on dark grounds. primitive.slate fails AA there (2.4:1). */
    mutedInverse: primitive.slateOnDark,
  },
  border: { default: primitive.mist, control: primitive.steel, strong: primitive.ink },
  action: { primaryBg: primitive.ink, primaryText: primitive.chalk },
  focus: { ring: primitive.ink },
  status: {
    success: primitive.teal,
    /** Low stock, awaiting review, pending. Never the accent. */
    attention: primitive.ember,
    error: primitive.crimson,
  },
  /** Brand accent only — never focus, warning or selection (MVP §6). A FILL
   * on pale surfaces, never type: acid on paper is 1.26:1. */
  accent: primitive.acid,
  /** The accent used AS type, on ink or graphite only (15.88:1 / 14.10:1). */
  accentOnDark: primitive.acid,
  /** Type sitting ON an accent ground (announcement bar, newsletter action). */
  accentText: primitive.ink,
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
