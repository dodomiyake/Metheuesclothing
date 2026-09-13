/**
 * The design's colour swatch is an exported asset (Colours#20:8) this
 * sandbox's network block on figma.com prevents downloading -- same class
 * of gap as components/site/icons.tsx. A small coloured dot per real colour
 * name is a reasonable stand-in until the real asset can be fetched; it
 * only needs to cover the colours actual variants use, not guess at ones
 * that don't exist yet.
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
