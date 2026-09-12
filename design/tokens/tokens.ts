/**
 * Metheues Clothings — design tokens
 * Generated from Figma file 9SzUlTWGVKOCkAULkbqOsr, 12 September 2026.
 * Mirrors tokens.css. Keep the two in step.
 */

export const primitive = {
  black: '#12100E',
  espresso: '#2B160F',
  ivory: '#F7F2E8',
  cream: '#FFFDF8',
  sand: '#DDD4C7',
  stone: '#68635D',
  stoneOnDark: '#8A8178',
  gold: '#B58A3C',
  oxblood: '#6D2633',
  forest: '#276749',
  red: '#B42318',
} as const;

export const color = {
  bg: { page: primitive.ivory, surface: primitive.cream, inverse: primitive.black },
  text: {
    primary: primitive.black,
    muted: primitive.stone,
    inverse: primitive.cream,
    /** Supporting text on dark grounds. primitive.stone fails AA there (3.2:1). */
    mutedInverse: primitive.stoneOnDark,
  },
  border: { default: primitive.sand, strong: primitive.black },
  action: { primaryBg: primitive.black, primaryText: primitive.cream },
  focus: { ring: primitive.black },
  status: {
    success: primitive.forest,
    /** Low stock, awaiting review, pending. Never gold. */
    attention: primitive.oxblood,
    error: primitive.red,
  },
  /** Brand accent only — never focus, warning or selection (MVP §6). */
  accent: primitive.gold,
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
  pageTitle: { size: 52, mobileSize: 38, font: font.display, weight: 400 },
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
