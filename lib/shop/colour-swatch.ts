/**
 * These are GARMENT colours, not the brand palette, and the two are no
 * longer the same thing — they happened to share hex values while the UI
 * palette was warm, and the September 2026 cool recolour separated them.
 * A T-shirt that comes in Ivory must still render an ivory dot even though
 * no UI surface is ivory any more, so do NOT "fix" these to match
 * design/tokens. They are keyed off product_variants.colour, so the right
 * source for a correction is the actual fabric, not tokens.css.
 *
 * Figma's own swatch is an exported asset (Colours#20:8), but it is a flat
 * mockup image of one product's example colours rather than a reusable
 * component, so a dot per real colour name is the right implementation
 * regardless: it covers whatever colours variants actually use instead of
 * guessing at ones that don't exist yet.
 */
const KNOWN: Record<string, string> = {
  black: '#12100E',
  ivory: '#F7F2E8',
  bone: '#E8E0D0',
  espresso: '#2B160F',
  white: '#FFFDF8',
  cream: '#FFFDF8',
  sand: '#DDD4C7',
  stone: '#68635D',
  navy: '#1B2A41',
  oxblood: '#6D2633',
  forest: '#276749',
  charcoal: '#2B2B2B',
  grey: '#8A8178',
  gray: '#8A8178',
};

export function swatchColour(colourName: string): string {
  return KNOWN[colourName.trim().toLowerCase()] ?? '#DDD4C7';
}
